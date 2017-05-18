/**
 * Created by Waruna on 5/18/2017.
 */

var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var DbConn = require('dvp-dbmodels');
var nodeUuid = require('node-uuid');
var moment = require('moment');
var Sequelize = require('sequelize');

var companyCollection = {};
var jobCollection = {};

module.exports.SaveDialInfo =function (req,res) {

    var contactList = req.body.ContactList;

    var dialerAgentDialInfo = [];

    if(contactList&&Array.isArray(contactList)){
        contactList.forEach(function (item) {
            dialerAgentDialInfo.push({
                DialerState: 'New',
                AttemptCount:0,
                ContactNumber: item,
                ResourceName: req.body.ResourceName,
                ResourceId:req.params.ResourceId,
                StartDate:req.body.StartDate,
                BatchName:req.body.BatchName,
                TenantId:  req.user.tenant,
                CompanyId:  req.user.company
            })
        });
    }

    var jobId = nodeUuid.v1();


    jobCollection[jobId]= {
        BatchName : req.body.BatchName,
        ResourceName:req.body.ResourceName,
        ResourceId:req.params.ResourceId,
        Status:"Pending",
        JobId:jobId,
        Company:req.user.company
    };

    if(!companyCollection[req.user.company]){
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
        companyCollection[req.user.company].splice(jobId,1);

    });
    jsonString = messageFormatter.FormatMessage(undefined, "SUCCESS", true, jobCollection[jobId]);
    res.end(jsonString);
};

module.exports.PendingJobList =function (req,res) {
    var jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION",true, companyCollection[req.user.company]);
    res.end(jsonString);
};

module.exports.CheckStatus =function (req,res) {

    var item =  jobCollection[req.params.jobId];
    var jsonString = messageFormatter.FormatMessage(new Error("Invalid Information."), "EXCEPTION",false, undefined);
    if(item&&item.Company===req.user.company){
        jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION",true, item);
    }
    res.end(jsonString);
};