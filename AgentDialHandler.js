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


function saveContactBulk(req, jobId) {
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
            });
        });
    }

    jobCollection[jobId.toString()] = {
        BatchName: batchName,
        ResourceName: req.body.ResourceName,
        ResourceId: req.params.ResourceId,
        Status: "Pending",
        JobId: jobId,
        Company: req.user.company
    };

    if (!companyCollection[req.user.iss.toString()]) {
        companyCollection[req.user.iss.toString()] = [];
    }
    if (!companyUserCollection[req.user.company.toString()]) {
        companyUserCollection[req.user.company.toString()] = [];
    }

    companyUserCollection[req.user.company.toString()].push(req.user.iss);
    companyCollection[req.user.iss.toString()].push(jobId);

    redisHandler.collectJobList(req.user.company, req.user.iss, jobId);

    var jsonString;
    DbConn.DialerAgentDialInfo.bulkCreate(
        dialerAgentDialInfo, {validate: false, individualHooks: true}
    ).then(function (results) {
        jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, results);
        logger.info("[Agent-Dial-handler.SaveDialInfo] - [PGSQL] - SaveContacts successfully.[%s] ", jsonString);
    }).catch(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
        logger.error("[Agent-Dial-handler.SaveDialInfo] - [%s] - [PGSQL] - SaveContacts failed", req.user.company, err);

    }).finally(function () {
        logger.info("SaveDialInfo Done...............................");
        delete jobCollection[jobId.toString()];

        redisHandler.deleteJob(req.user.iss, jobId);
        companyCollection[req.user.iss.toString()].splice(jobId, 1);
        if (companyCollection[req.user.iss.toString()].length === 0) {
            delete companyCollection[req.user.iss.toString()];
        }

    });
}

module.exports.SaveDialInfo = function (req, res) {


    if (!req.user || !req.user.tenant || !req.user.company) {
        throw new Error("invalid tenant or company.");
    }
    else {
        var jobId = req.body.BatchName + "_-_" + nodeUuid.v1();
        saveContactBulk(req, jobId);

        res.end(messageFormatter.FormatMessage(null, "SUCCESS", true, jobCollection[jobId.toString()]));
    }

};

function saveNumbers(req, agentNumberList, res) {

    if (!req.user || !req.user.tenant || !req.user.company) {
        throw new Error("invalid tenant or company.");
    }
    else {
        var tenant = req.user.tenant;
        var company = req.user.company;
        var batchName = req.body.BatchName;
        var startDate = req.body.StartDate;

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
                            StartDate: startDate,
                            BatchName: batchName,
                            TenantId: tenant,
                            CompanyId: company
                        });
                    });
                }
                console.log(next);

                asyncvalidateUserAndGroupTasks.push(function (callback) {
                    DbConn.DialerAgentDialInfo.bulkCreate(
                        dialerAgentDialInfo, {validate: false, individualHooks: true}
                    ).then(function (results) {
                        callback(null, results);
                    }).catch(function (err) {
                        callback(err, null);
                    }).finally(function () {
                        console.log("Job Done!");
                    });
                });
            }
        });

        async.parallel(asyncvalidateUserAndGroupTasks, function (err, results) {
            console.log("Task Complete!");
            res.end(messageFormatter.FormatMessage(null, "SUCCESS", true, results));
        });
    }

}

module.exports.AssingNumberToAgent = function (req, res) {

    var agentNumberList = {};
    var agentList = req.body.AgentList;
    var numberColumnName = req.body.NumberColumnName;
    var dataColumnName = req.body.DataColumnName;
    var tempData = req.body.NumberList;

    if (req.body.Mechanism === "Random") {
        tempData.sort(function () {
            return 0.5 - Math.random();
        });
    }

    var chunk = Math.ceil(tempData.length / agentList.length);
    var i = 0;
    while (tempData.length) {
        var agent = agentList[i.toString()];
        agentNumberList[agent.displayName] = {
            "ResourceId": agent._id,
            "ResourceName": agent.displayName,
            "Data": tempData.splice(0, chunk).map(function (item) {
                return {Number: item[numberColumnName.toString()], OtherData: item[dataColumnName.toString()]};
            })
        };
        i++;
    }

    saveNumbers(req, agentNumberList, res);
};

var addToHistory = function (item) {

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

        jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, results);
        logger.info("addToHistory - [PGSQL] - Updated successfully.[%s] ", jsonString);

    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
        logger.error("addToHistory - [%s] - [PGSQL] - UpdateDialInfo failed-[%s]", item.AgentDialNumberId, err);
    });
};

module.exports.UpdateDialInfo = function (req, res) {


    var jsonString;
    if (!req.user || !req.user.tenant || !req.user.company) {
        jsonString = messageFormatter.FormatMessage(new Error("invalid tenant or company."), "EXCEPTION", false, null);
        res.end(jsonString);
    }
    else {
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


                    addToHistory(cmp);
                    jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, results);
                    logger.info("UpdateDialInfo - [PGSQL] - Updated successfully.[%s] ", jsonString);
                    res.end(jsonString);

                }).error(function (err) {
                    jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
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
            jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
            res.end(jsonString);
        });
    }

};

module.exports.UpdateDialInfoOnly = function (req, res) {


    var jsonString;
    if (!req.user || !req.user.tenant || !req.user.company) {
        jsonString = messageFormatter.FormatMessage(new Error("invalid tenant or company."), "EXCEPTION", false, null);
        res.end(jsonString);
    }
    else {
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
                DbConn.DialerAgentDialInfo
                    .update(
                        {
                            DialerState: req.body.DialerState,
                            OtherData: req.body.OtherData,
                            Redial: req.body.Redial
                        },
                        {
                            where: [{AgentDialNumberId: dialId}, {TenantId: req.user.tenant}, {CompanyId: req.user.company}]
                        }
                    ).then(function (results) {


                    addToHistory(cmp);
                    jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, results);
                    logger.info("UpdateDialInfo - [PGSQL] - Updated successfully.[%s] ", jsonString);
                    res.end(jsonString);

                }).error(function (err) {
                    jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
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
            jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
            res.end(jsonString);
        });
    }

};

module.exports.GetNumberList = function (req, res) {

    var jsonString;

    function getNumbers() {
        var pageNo = req.params.pageNo;
        var rowCount = req.params.rowCount;

        if (!req.params.StartDate) {
            throw new error.ValidationError("Invalid Start Date.");
        }

        //where: [{TenantId: req.user.tenant},{CompanyId: req.user.company}]
        var query = {
            //where: [{StartDate: {$lte:moment.utc(req.params.StartDate).format('YYYY-MM-DD HH:mm:ss.SSS Z') }},
            where: [{StartDate: {$lte:moment.utc(req.params.StartDate).format('YYYY-MM-DD') }},
                {ResourceId: req.params.ResourceId},
                {TenantId: req.user.tenant},
                {CompanyId: req.user.company},
                {$or: [
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
                ]}],
            offset: ((pageNo - 1) * rowCount),
            limit: rowCount,
            order: [["StartDate", "ASC"], ["AttemptCount", "ASC"]]
        };


        if (req.params.BatchName) {
            query.where.push({BatchName: req.params.BatchName});
        }

        DbConn.DialerAgentDialInfo
            .findAll(query

            ).then(function (cmp) {
            jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, cmp);
            res.end(jsonString);
        }).error(function (err) {
            logger.error("GetNumberList - [%s] - [PGSQL]  failed", req.params.ResourceId, err);
            jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
            res.end(jsonString);
        });
    }

    if (!req.user || !req.user.tenant || !req.user.company) {
        throw new Error("invalid tenant or company.");
    }
    else {
        getNumbers();
    }
};

module.exports.pendingJobList = function (req, res) {
    if (!req.user || !req.user.tenant || !req.user.company) {
        throw new Error("invalid tenant or company.");
    }

    redisHandler.pendingJobList(req.user.iss, res);
    /*var jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, companyCollection[req.user.iss]);
     res.end(jsonString);*/
};

module.exports.CheckStatus = function (req, res) {

    var item = jobCollection[req.params.jobId.toString()];
    var jsonString = messageFormatter.FormatMessage(new Error("Invalid Information."), "EXCEPTION", false, null);
    if (item && item.Company === req.user.company) {
        jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, item);
    }
    res.end(jsonString);
};

module.exports.HeaderDetails = function (req, res) {

    var jsonString;

    var querys = [{
        attributes: [
            [DbConn.SequelizeConn.fn("DISTINCT", DbConn.SequelizeConn.col("BatchName")), "BatchName"]
        ],
        where: [{TenantId: req.user.tenant},
            {CompanyId: req.user.company}]
    },
        {
            attributes: [
                [DbConn.SequelizeConn.fn("DISTINCT", DbConn.SequelizeConn.col("DialerState")), "DialerState"]
            ],
            where: [{TenantId: req.user.tenant},
                {CompanyId: req.user.company}]
        }];

    if (req.params.ResourceId) {
        querys[0].where.push({ResourceId: req.params.ResourceId});
        querys[1].where.push({ResourceId: req.params.ResourceId});
    }

    var functions = [];
    querys.forEach(function (query) {
        functions.push(function (callback) {
            DbConn.DialerAgentDialInfo
                .findAll(
                    query
                ).then(function (cmp) {
                callback(null, cmp);
            }).error(function (err) {
                callback(err, null);
            });
        });

    });

    async.parallel(functions,
        function (err, results) {
            var out;
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
                res.end(jsonString);
            } else {
                var response = {};
                if (results[0]) {
                    out = Object.keys(results[0]).map(function (data) {
                        return results[0][data.toString()].dataValues.BatchName;
                    });
                    response["BatchName"] = out;
                }
                if (results[1]) {
                    out = Object.keys(results[1]).map(function (data) {
                        return results[1][data.toString()].dataValues.DialerState;
                    });
                    response["DialerState"] = out;
                }
                jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, response);
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

    if (req.params.Resource) {
        query.where.push({ResourceId: req.params.Resource});
    }

    DbConn.DialerAgentDialInfo.count(query).then(function (CamObject) {

        if (CamObject) {
            jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, CamObject);
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("No record"), "EXCEPTION", false, null);
        }
        res.end(jsonString);
    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
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

    if (req.params.Resource) {
        query.where.push({ResourceId: req.params.Resource});
    }

    DbConn.DialerAgentDialInfo.findAll(query).then(function (CamObject) {

        if (CamObject) {
            jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, CamObject);
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("No record"), "EXCEPTION", false, null);
        }
        res.end(jsonString);
    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
        res.end(jsonString);
    });

};

var extractResourceWiseSummary = function(batchName, startDate, endDate, companyId, tenantId, resourceName, callback)
{
    try
    {
        var query = {where :[{StartDate : { gte: startDate , lt: endDate}, CompanyId: companyId, TenantId: tenantId, ResourceId: resourceName}]};
        if(batchName)
        {
            query.where[0].BatchName = batchName;
        }

        DbConn.DialerAgentDialInfo.aggregate('*', 'count', query).then(function(tryCount)
        {
            var obj = {
                Resource: resourceName,
                TryCount: tryCount
            };
            callback(null, obj);
        }).catch(function(err)
        {
            callback(err, null);
        });

    }
    catch(ex)
    {
        callback(ex, null);
    }

};

module.exports.agentDialerAgentSummaryReport = function (req, res) {
    var jsonString;
    var tenantId = req.user.tenant;
    var companyId = req.user.company;
    //var pageNo = req.params.pageNo;
    //var rowCount = req.params.rowCount;
    var startDate = req.params.StartDate;
    var endDate = req.params.EndDate;
    var batchName = req.params.BatchName;

    var query = {where :[{StartDate : { gte: startDate , lt: endDate}, CompanyId: companyId, TenantId: tenantId}], plain: false};

    if(batchName)
    {
        query.where[0].BatchName = batchName;
    }

    DbConn.DialerAgentDialInfo.aggregate('ResourceId', 'DISTINCT', query).then(function (distinctResources)
    {
        if (distinctResources)
        {
            var arr = [];
            distinctResources.forEach(function(resource)
            {
                arr.push(extractResourceWiseSummary.bind(this, batchName, startDate, endDate, companyId, tenantId, resource.DISTINCT));

            });

            async.parallel(arr, function(err, results)
            {
                if(err)
                {
                    jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
                }
                else
                {
                    jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, results);
                }

                res.end(jsonString);

            })

        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("No record"), "EXCEPTION", false, null);

            res.end(jsonString);
        }

    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
        res.end(jsonString);
    });

    /*var query = {
        where: [{CompanyId: companyId.toString()}, {TenantId: tenantId.toString()}],
        //offset: ((pageNo - 1) * rowCount),
        //limit: rowCount,
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
            jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, CamObject);
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("No record"), "EXCEPTION", false, null);
        }
        res.end(jsonString);
    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
        res.end(jsonString);
    });*/

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

    if (req.params.Resource) {
        query.where.push({ResourceId: req.params.Resource});
    }

    DbConn.DialerAgentDialInfoHistory.count(query).then(function (CamObject) {

        if (CamObject) {
            jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, CamObject);
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("No record"), "EXCEPTION", false, null);
        }
        res.end(jsonString);
    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
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
        order: [["AgentDialHistoryId", "DESC"]]  //""AgentDialHistoryId" DESC"
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

    if (req.params.Resource) {
        query.where.push({ResourceId: req.params.Resource});
    }

    DbConn.DialerAgentDialInfoHistory.findAll(query).then(function (CamObject) {

        if (CamObject) {
            jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, CamObject);
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error("No record"), "EXCEPTION", false, null);
        }
        res.end(jsonString);
    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
        res.end(jsonString);
    });

};
