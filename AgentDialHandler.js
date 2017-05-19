/**
 * Created by Waruna on 5/18/2017.
 */

var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var DbConn = require('dvp-dbmodels');
var nodeUuid = require('node-uuid');
var moment = require('moment');
var Sequelize = require('sequelize');
var async = require('async');

var companyCollection = {};
var jobCollection = {};

module.exports.SaveDialInfo = function (req, res) {

    var contactList = req.body.ContactList;

    var dialerAgentDialInfo = [];

    if (contactList && Array.isArray(contactList)) {
        contactList.forEach(function (item) {
            dialerAgentDialInfo.push({
                DialerState: 'New',
                AttemptCount: 0,
                ContactNumber: item,
                ResourceName: req.body.ResourceName,
                ResourceId: req.params.ResourceId,
                StartDate: req.body.StartDate,
                BatchName: req.body.BatchName,
                TenantId: req.user.tenant,
                CompanyId: req.user.company
            })
        });
    }

    var jobId = nodeUuid.v1();


    jobCollection[jobId] = {
        BatchName: req.body.BatchName,
        ResourceName: req.body.ResourceName,
        ResourceId: req.params.ResourceId,
        Status: "Pending",
        JobId: jobId,
        Company: req.user.company
    };

    if (!companyCollection[req.user.company]) {
        companyCollection[req.user.company] = [];
    }
    companyCollection[req.user.company].push(jobId);

    var jsonString;
    DbConn.DialerAgentDialInfo.bulkCreate(
        dialerAgentDialInfo, {validate: false, individualHooks: true}
    ).then(function (results) {
        jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, results);
        logger.info('[Agent-Dial-handler.SaveDialInfo] - [PGSQL] - SaveContacts successfully.[%s] ', jsonString);
    }).catch(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        logger.error('[Agent-Dial-handler.SaveDialInfo] - [%s] - [PGSQL] - SaveContacts failed', req.user.company, err);

    }).finally(function () {
        logger.info('SaveDialInfo Done...............................');
        delete jobCollection[jobId];
        companyCollection[req.user.company].splice(jobId, 1);

    });
    jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, jobCollection[jobId]);
    res.end(jsonString);
};

module.exports.AssingNumberToAgent = function (req, res) {

    var agentNumberList = {};
    var agentList = req.body.AgentList;
    var numberColumnName = req.body.NumberColumnName;
    var dataColumnName = req.body.DataColumnName;
    var tempData = req.body.NumberList;
    if (req.body.Mechanism === 'Random') {
        tempData.sort(function () {
            return 0.5 - Math.random()
        });
    }

    var chunk = Math.ceil(tempData.length / agentList.length);
    var i = 0;
    while (tempData.length) {
        var agent = agentList[i];
        agentNumberList[agent.ResourceName] = {
            'ResourceId': agent.ResourceId,
            'ResourceName': agent.ResourceName,
            'Data': tempData.splice(0, chunk).map(function (item) {
                return {Number :item[numberColumnName],OtherData :item[dataColumnName]}
            })
        };
        i++;
    }

    var tenant = req.user.tenant;
    var company = req.user.company;

    var asyncvalidateUserAndGroupTasks = [];

    async.forEach(agentNumberList, function(item, next) {

        var dialerAgentDialInfo = [];
                if (item) {
            item.Data.forEach(function (i) {
                dialerAgentDialInfo.push({
                    DialerState: 'New',
                    AttemptCount: 0,
                    ContactNumber: i.Number,
                    OtherData: i.OtherData,
                    ResourceName: item.ResourceName,
                    ResourceId: item.ResourceId,
                    StartDate: item.StartDate,
                    BatchName: item.BatchName,
                    TenantId: tenant,
                    CompanyId: company
                })
            });
        }

        asyncvalidateUserAndGroupTasks.push(function (callback) {
            DbConn.DialerAgentDialInfo.bulkCreate(
                dialerAgentDialInfo, {validate: false, individualHooks: true}
            ).then(function (results) {
                callback(undefined,results);
            }).catch(function (err) {
                callback(err, undefined);
            }).finally(function () {
                console.log("Job Done ......");
            });
        });
    });

    async.parallel(asyncvalidateUserAndGroupTasks, function (err,results) {
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
                TenantId: item.TenantId,
                CompanyId: item.CompanyId
            }
        ).then(function (results) {

        jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, results);
        logger.info('AddToHistory - [PGSQL] - Updated successfully.[%s] ', jsonString);

    }).error(function (err) {
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        logger.error('AddToHistory - [%s] - [PGSQL] - UpdateDialInfo failed-[%s]', item.AgentDialNumberId, err);
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
        ).then(function ( cmp) {
        if(cmp){
            DbConn.DialerAgentDialInfo
                .update(
                    {
                        DialerState: req.body.DialerState,
                        AttemptCount: req.body.AttemptCount
                    },
                    {
                        where: {
                            where: [{AgentDialNumberId: dialId}, {TenantId: req.user.tenant}, {CompanyId: req.user.company}]
                        }
                    }
                ).then(function (results) {

                cmp.DialerState = req.body.DialerState;
                cmp.AttemptCount = req.body.AttemptCount;
                AddToHistory(cmp);
                jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, results);
                logger.info('UpdateDialInfo - [PGSQL] - Updated successfully.[%s] ', jsonString);
                res.end(jsonString);

            }).error(function (err) {
                jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
                logger.error('UpdateDialInfo - [%s] - [PGSQL] - UpdateDialInfo failed-[%s]', dialId, err);
                res.end(jsonString);
            });
        }
        else {
            jsonString = messageFormatter.FormatMessage(new Error('No record'), "EXCEPTION", false, undefined);
            res.end(jsonString);
        }
    }).error(function (err) {
        logger.error('UpdateDialInfo - [%s] - [PGSQL] - UpdateDialInfo  failed', dialId, err);
        jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        res.end(jsonString);
    });
};

module.exports.PendingJobList = function (req, res) {
    var jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, companyCollection[req.user.company]);
    res.end(jsonString);
};

module.exports.CheckStatus = function (req, res) {

    var item = jobCollection[req.params.jobId];
    var jsonString = messageFormatter.FormatMessage(new Error("Invalid Information."), "EXCEPTION", false, undefined);
    if (item && item.Company === req.user.company) {
        jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, item);
    }
    res.end(jsonString);
};