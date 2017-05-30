/**
 * Created by Waruna on 5/18/2017.
 */

var messageFormatter = require("dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js");
var logger = require("dvp-common/LogHandler/CommonLogHandler.js").logger;
var redisHandler = require("./RedisHandler");
var DbConn = require("dvp-dbmodels");
var nodeUuid = require("node-uuid");
var moment = require("moment");
/*var Sequelize = require("sequelize");*/
var async = require("async");

var companyCollection = {};
var companyUserCollection = {};
var jobCollection = {};

module.exports.SaveDialInfo = function (req, res) {

    var contactList = req.body.ContactList;

    var dialerAgentDialInfo = [];
    var batchName = req.body.BatchName;
    if (contactList && Array.isArray(contactList)) {
        contactList.forEach(function (item) {
            dialerAgentDialInfo.push({
                DialerState: "New",
                AttemptCount: 0,
                ContactNumber: item.Number,
                ResourceName: req.body.ResourceName,
                ResourceId: req.params.ResourceId,
                StartDate: req.body.StartDate,
                OtherData: item.OtherData,
                BatchName: batchName,
                TenantId: req.user.tenant,
                CompanyId: req.user.company
            })
        });
    }

    var jobId = batchName + "_-_" + nodeUuid.v1();


    jobCollection[jobId] = {
        BatchName: batchName,
        ResourceName: req.body.ResourceName,
        ResourceId: req.params.ResourceId,
        Status: "Pending",
        JobId: jobId,
        Company: req.user.company
    };

    if (!companyCollection[req.user.iss]) {
        companyCollection[req.user.iss] = [];
    }
    if (!companyUserCollection[req.user.company]) {
        companyUserCollection[req.user.company] = [];
    }

    companyUserCollection[req.user.company].push(req.user.iss);
    companyCollection[req.user.iss].push(jobId);

    redisHandler.CollectJobList(req.user.company, req.user.iss, jobId);

    var jsonString;
    DbConn.DialerAgentDialInfo.bulkCreate(
        dialerAgentDialInfo, {validate: false, individualHooks: true}
    ).then(function (results) {
        jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, results);
        logger.info("[Agent-Dial-handler.SaveDialInfo] - [PGSQL] - SaveContacts successfully.[%s] ", jsonString);
    }).catch(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        logger.error("[Agent-Dial-handler.SaveDialInfo] - [%s] - [PGSQL] - SaveContacts failed", req.user.company, err);

    }).finally(function () {
        logger.info("SaveDialInfo Done...............................");
        delete jobCollection[jobId];

        redisHandler.DeleteJob(req.user.iss, jobId);
        companyCollection[req.user.iss].splice(jobId, 1);
        if (companyCollection[req.user.iss].length === 0) {
            delete companyCollection[req.user.iss];
        }

    });
    jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, jobCollection[jobId]);
    res.end(jsonString);
};

module.exports.AssingNumberToAgent = function (req, res) {

    if (!req.user || !req.user.tenant || !req.user.company) {
        res.end(messageFormatter.FormatMessage(new Error("invalid tenant or company."), "EXCEPTION", false, null));
        return;
    }
    var agentNumberList = {};
    var agentList = req.body.AgentList;
    var numberColumnName = req.body.NumberColumnName;
    var dataColumnName = req.body.DataColumnName;
    var tempData = req.body.NumberList;
    var BatchName = req.body.BatchName;
    var StartDate = req.body.StartDate;
    if (req.body.Mechanism === "Random") {
        tempData.sort(function () {
            return 0.5 - Math.random()
        });
    }

    var chunk = Math.ceil(tempData.length / agentList.length);
    var i = 0;
    while (tempData.length) {
        var agent = agentList[i];
        agentNumberList[agent.displayName] = {
            "ResourceId": agent._id,
            "ResourceName": agent.displayName,
            "Data": tempData.splice(0, chunk).map(function (item) {
                return {Number: item[numberColumnName], OtherData: item[dataColumnName]}
            })
        };
        i++;
    }

    var tenant = req.user.tenant;
    var company = req.user.company;

    var asyncvalidateUserAndGroupTasks = [];

    async.forEach(agentNumberList, function (item, next) {
        if (item.Data) {
            var dialerAgentDialInfo = [];
            if (item) {
                item.Data.forEach(function (i) {
                    dialerAgentDialInfo.push({
                        DialerState: "New",
                        AttemptCount: 0,
                        ContactNumber: i.Number,
                        OtherData: i.OtherData,
                        ResourceName: item.ResourceName,
                        ResourceId: item.ResourceId,
                        StartDate: StartDate,
                        BatchName: BatchName,
                        TenantId: tenant,
                        CompanyId: company
                    })
                });
            }

            asyncvalidateUserAndGroupTasks.push(function (callback) {
                DbConn.DialerAgentDialInfo.bulkCreate(
                    dialerAgentDialInfo, {validate: false, individualHooks: true}
                ).then(function (results) {
                    callback(undefined, results);
                }).catch(function (err) {
                    callback(err, undefined);
                }).finally(function () {
                    console.log("Job Done ......" + next);
                });
            });
        }
    });

    async.parallel(asyncvalidateUserAndGroupTasks, function (err, results) {
        console.log("Task Complete.........................");
        res.end(messageFormatter.FormatMessage(undefined, "SUCCESS", true, results));
    });

};

var AddToHistory = function (item) {

    var jsonString;

    DbConn.DialerAgentDialInfoHistory
        .create(
            {
                DialerState: item.DialerState,
                AttemptCount: item.AttemptCount,
                ContactNumber: item.ContactNumber,
                ResourceName: item.ResourceName,
                ResourceId: item.ResourceId,
                StartDate: item.StartDate,
                BatchName: item.BatchName,
                AgentDialNumberId: item.AgentDialNumberId,
                OtherData: item.OtherData,
                TenantId: item.TenantId,
                CompanyId: item.CompanyId
            }
        ).then(function (results) {

        jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, results);
        logger.info("AddToHistory - [PGSQL] - Updated successfully.[%s] ", jsonString);

    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        logger.error("AddToHistory - [%s] - [PGSQL] - UpdateDialInfo failed-[%s]", item.AgentDialNumberId, err);
    });
};

module.exports.UpdateDialInfo = function (req, res) {

    var jsonString;
    var dialId = req.params.AgentDialNumberId;

    DbConn.DialerAgentDialInfo
        .find(
            {
                where: [{AgentDialNumberId: dialId}, {TenantId: req.user.tenant}, {CompanyId: req.user.company}]
            }
        ).then(function (cmp) {
        if (cmp) {
            cmp.DialerState = req.body.DialerState;
            cmp.OtherData = req.body.OtherData;
            cmp.AttemptCount = cmp.AttemptCount + 1;
            DbConn.DialerAgentDialInfo
                .update(
                    {
                        DialerState: req.body.DialerState,
                        OtherData: req.body.OtherData,
                        AttemptCount: cmp.AttemptCount,
                        Redial: req.body.Redial
                    },
                    {
                        where: [{AgentDialNumberId: dialId}, {TenantId: req.user.tenant}, {CompanyId: req.user.company}]
                    }
                ).then(function (results) {


                AddToHistory(cmp);
                jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, results);
                logger.info("UpdateDialInfo - [PGSQL] - Updated successfully.[%s] ", jsonString);
                res.end(jsonString);

            }).error(function (err) {
                jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
                logger.error("UpdateDialInfo - [%s] - [PGSQL] - UpdateDialInfo failed-[%s]", dialId, err);
                res.end(jsonString);
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("No record"), "EXCEPTION", false, null);
            res.end(jsonString);
        }
    }).error(function (err) {
        logger.error("UpdateDialInfo - [%s] - [PGSQL] - UpdateDialInfo  failed", dialId, err);
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        res.end(jsonString);
    });
};

module.exports.GetNumberList = function (req, res) {

    var jsonString;

    /*DbConn.ResAttribute.findAll({
     where: [{Status: true}, {TenantId: tenantId}, {CompanyId: companyId}], offset: ((pageNo - 1) * rowCount),
     limit: rowCount,order: [["AttributeId", "DESC"]]
     })*/

    var pageNo = req.params.pageNo;
    var rowCount = req.params.rowCount;

    DbConn.DialerAgentDialInfo
        .findAll(
            {
                where: {
                    StartDate: {$lte: req.params.StartDate},
                    ResourceId: req.params.ResourceId,
                    TenantId: req.user.tenant,
                    CompanyId: req.user.company,
                    $or: [
                        {
                            Redial: {
                                $eq: true
                            }
                        },
                        {
                            DialerState: {
                                $eq: "New"
                            }
                        }
                    ]
                },
                offset: ((pageNo - 1) * rowCount),
                limit: rowCount,
                order: [["StartDate", "ASC"], ["AttemptCount", "ASC"]]
            }
        ).then(function (cmp) {
        jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, cmp);
        res.end(jsonString);
    }).error(function (err) {
        logger.error("GetNumberList - [%s] - [PGSQL]  failed", req.params.ResourceId, err);
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        res.end(jsonString);
    });

    /*DbConn.DialerAgentDialInfo
     .findAll(
     {
     where: [{
     DialerState: "New"
     },{Redial:true}, {StartDate: {$lte: req.params.StartDate}}, {ResourceId: req.params.ResourceId}, {TenantId: req.user.tenant}, {CompanyId: req.user.company}],
     offset: ((pageNo - 1) * rowCount),
     limit: rowCount,
     order: [["StartDate", "ASC"], ["AttemptCount", "ASC"]]
     }
     ).then(function (cmp) {
     jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, cmp);
     res.end(jsonString);
     }).error(function (err) {
     logger.error("GetNumberList - [%s] - [PGSQL]  failed", req.params.ResourceId, err);
     jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
     res.end(jsonString);
     });*/
};

module.exports.PendingJobList = function (req, res) {
    redisHandler.PendingJobList(req.user.iss, res);
    /*var jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, companyCollection[req.user.iss]);
     res.end(jsonString);*/
};

module.exports.CheckStatus = function (req, res) {

    var item = jobCollection[req.params.jobId];
    var jsonString = messageFormatter.FormatMessage(new Error("Invalid Information."), "EXCEPTION", false, undefined);
    if (item && item.Company === req.user.company) {
        jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, item);
    }
    res.end(jsonString);
};

module.exports.HeaderDetails = function (req, res) {

    var jsonString;

    var querys = [{
        attributes: [
            [DbConn.SequelizeConn.fn('DISTINCT', DbConn.SequelizeConn.col('"BatchName"')), 'BatchName']
        ],
        where: [{TenantId: req.user.tenant},
            {CompanyId: req.user.company}]
    },
        {
            attributes: [
                [DbConn.SequelizeConn.fn('DISTINCT', DbConn.SequelizeConn.col("DialerState")), 'DialerState']
            ],
            where: [{TenantId: req.user.tenant},
                {CompanyId: req.user.company}]
        }];

    var functions = [];
    querys.forEach(function (query) {
        functions.push(function (callback) {
            DbConn.DialerAgentDialInfo
                .findAll(
                    query
                ).then(function (cmp) {
                callback(undefined, cmp);
            }).error(function (err) {
                callback(err, undefined);
            });
        });

    });

    async.parallel(functions,
        function (err, results) {
            var out;
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
                res.end(jsonString);
            } else {
                var response = {};
                if (results[0]) {
                    out = Object.keys(results[0]).map(function (data) {
                        return results[0][data].dataValues.BatchName;
                    });
                    response['BatchName'] = out;
                }
                if (results[1]) {
                    out = Object.keys(results[1]).map(function (data) {
                        return results[1][data].dataValues.DialerState;
                    });
                    response['DialerState'] = out;
                }
                jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, response);
                res.end(jsonString);
            }
        });

};

module.exports.agentDialerDispositionSummaryReportCount = function (req, res) {
    var jsonString;
    var tenantId = req.user.tenant;
    var companyId = req.user.company;

    var query = {
        where: [{CompanyId: companyId.toString()}, {TenantId: tenantId.toString()}]
    };


    if (req.params.TryCount && req.params.TryCount > 0) {
        query.where.push({AttemptCount: {$gte: req.params.TryCount}});
    }
    if (req.params.DialerState) {
        query.where.push({DialerState: req.params.DialerState});
    }
    if (req.params.BatchName) {
        query.where.push({BatchName: req.params.BatchName});
    }

    DbConn.DialerAgentDialInfo.count(query).then(function (CamObject) {

        if (CamObject) {
            jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, CamObject);
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error('No record'), "EXCEPTION", false, undefined);
        }
        res.end(jsonString);
    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        res.end(jsonString);
    });

};

module.exports.agentDialerDispositionSummaryReport = function (req, res) {
    var jsonString;
    var tenantId = req.user.tenant;
    var companyId = req.user.company;
    var pageNo = req.params.pageNo;
    var rowCount = req.params.rowCount;

    var query = {
        where: [{CompanyId: companyId.toString()}, {TenantId: tenantId.toString()}],
        offset: ((pageNo - 1) * rowCount),
        limit: rowCount,
        order: [["AgentDialNumberId", "DESC"]]
    };


    if (req.params.TryCount && req.params.TryCount > 0) {
        query.where.push({AttemptCount: {$gte: req.params.TryCount}});
    }
    if (req.params.DialerState) {
        query.where.push({DialerState: req.params.DialerState});
    }
    if (req.params.BatchName) {
        query.where.push({BatchName: req.params.BatchName});
    }

    DbConn.DialerAgentDialInfo.findAll(query).then(function (CamObject) {

        if (CamObject) {
            jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, CamObject);
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error('No record'), "EXCEPTION", false, undefined);
        }
        res.end(jsonString);
    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        res.end(jsonString);
    });

};

module.exports.agentDialerDispositionDetailsReportCount = function (req, res) {
    var jsonString;
    var tenantId = req.user.tenant;
    var companyId = req.user.company;

    var query = {
        where: [{CompanyId: companyId.toString()}, {TenantId: tenantId.toString()}]
    };


    if (req.params.TryCount && req.params.TryCount > 0) {
        query.where.push({AttemptCount: {$gte: req.params.TryCount}});
    }
    if (req.params.DialerState) {
        query.where.push({DialerState: req.params.DialerState});
    }
    if (req.params.BatchName) {
        query.where.push({BatchName: req.params.BatchName});
    }

    DbConn.DialerAgentDialInfoHistory.count(query).then(function (CamObject) {

        if (CamObject) {
            jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, CamObject);
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error('No record'), "EXCEPTION", false, undefined);
        }
        res.end(jsonString);
    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        res.end(jsonString);
    });

};

module.exports.agentDialerDispositionDetailsReport = function (req, res) {
    var jsonString;
    var tenantId = req.user.tenant;
    var companyId = req.user.company;
    var pageNo = req.params.pageNo;
    var rowCount = req.params.rowCount;

    var query = {
        where: [{CompanyId: companyId.toString()}, {TenantId: tenantId.toString()}],
        offset: ((pageNo - 1) * rowCount),
        limit: rowCount,
        order: [["AgentDialHistoryId", "DESC"]]  //'"AgentDialHistoryId" DESC'
    };


    if (req.params.TryCount && req.params.TryCount > 0) {
        query.where.push({AttemptCount: {$gte: req.params.TryCount}});
    }
    if (req.params.DialerState) {
        query.where.push({DialerState: req.params.DialerState});
    }
    if (req.params.BatchName) {
        query.where.push({BatchName: req.params.BatchName});
    }

    DbConn.DialerAgentDialInfoHistory.findAll(query).then(function (CamObject) {

        if (CamObject) {
            jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, CamObject);
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error('No record'), "EXCEPTION", false, undefined);
        }
        res.end(jsonString);
    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        res.end(jsonString);
    });

};
