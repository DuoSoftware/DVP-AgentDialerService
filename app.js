/**
 * Created by Rajinda on 05/18/2017.
 */

var restify = require("restify");
var messageFormatter = require("dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js");

var config = require("config");

var port = config.Host.port || 3000;
var version = config.Host.version;
var logger = require("dvp-common/LogHandler/CommonLogHandler.js").logger;
var agentDialHandler = require("./AgentDialHandler");
var redisHandler = require("./RedisHandler");


//-------------------------  Restify Server ------------------------- \\
var RestServer = restify.createServer({
    name: "AgentDialerService",
    version: "1.0.0"
}, function (req, res) {

});
restify.CORS.ALLOW_HEADERS.push("api_key");
restify.CORS.ALLOW_HEADERS.push("authorization");

RestServer.use(restify.CORS());
RestServer.use(restify.fullResponse());
//Enable request body parsing(access)
RestServer.use(restify.bodyParser());
RestServer.use(restify.acceptParser(RestServer.acceptable));
RestServer.use(restify.queryParser());

// ---------------- Security -------------------------- \\
var jwt = require("restify-jwt");
var secret = require("dvp-common/Authentication/Secret.js");
var authorization = require("dvp-common/Authentication/Authorization.js");
RestServer.use(jwt({secret: secret.Secret}));
// ---------------- Security -------------------------- \\

//Server listen
RestServer.listen(port, function () {
    console.log("%s listening at %s", RestServer.name, RestServer.url);

});

//------------------------- End Restify Server ------------------------- \\


//------------------------- Agent Dial Handler ------------------------- \\

RestServer.post("/DVP/API/" + version + "/AgentDialer/AssignNumbers", authorization({
    resource: "agentDialer",
    action: "write"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[AssingNumberToAgent] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));
        agentDialHandler.AssingNumberToAgent(req, res);

    }
    catch (ex) {

        logger.error("[AssingNumberToAgent] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[AssingNumberToAgent] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.post("/DVP/API/" + version + "/AgentDialer/Resource/:ResourceId/Dial", authorization({
    resource: "agentDialer",
    action: "write"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[SaveDialInfo] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));
        agentDialHandler.SaveDialInfo(req, res);
    }
    catch (ex) {

        logger.error("[SaveDialInfo] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[SaveDialInfo] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get("/DVP/API/" + version + "/AgentDialer/Job", authorization({
    resource: "agentDialer",
    action: "write"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[CheckStatus] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));
        agentDialHandler.pendingJobList(req, res);

    }
    catch (ex) {

        logger.error("[CheckStatus] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[CheckStatus] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.del("/DVP/API/" + version + "/AgentDialer/Job", authorization({
    resource: "agentDialer",
    action: "write"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[CheckStatus] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));
        redisHandler.DeletePendingJob(req, res);

    }
    catch (ex) {

        logger.error("[CheckStatus] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[CheckStatus] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.put("/DVP/API/" + version + "/AgentDialer/Number/:AgentDialNumberId/Status", authorization({
    resource: "agentDialer",
    action: "write"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[UpdateDialInfo] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));
        agentDialHandler.UpdateDialInfo(req, res);

    }
    catch (ex) {

        logger.error("[UpdateDialInfo] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[UpdateDialInfo] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.put("/DVP/API/" + version + "/AgentDialer/Number/:AgentDialNumberId/OnlyStatus", authorization({
    resource: "agentDialer",
    action: "write"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[UpdateDialInfoOnly] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));
        agentDialHandler.UpdateDialInfoOnly(req, res);

    }
    catch (ex) {

        logger.error("[UpdateDialInfoOnly] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[UpdateDialInfoOnly] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get("/DVP/API/" + version + "/AgentDialer/Job/:jobId", authorization({
    resource: "agentDialer",
    action: "write"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[CheckStatus] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));

        agentDialHandler.CheckStatus(req, res);

    }
    catch (ex) {

        logger.error("[CheckStatus] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[CheckStatus] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get("/DVP/API/" + version + "/AgentDialer/Resource/:ResourceId/Numbers", authorization({
    resource: "agentDialer",
    action: "read"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[GetNumberList] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));
        agentDialHandler.GetNumberList(req, res);

    }
    catch (ex) {

        logger.error("[GetNumberList] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[GetNumberList] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get("/DVP/API/" + version + "/AgentDialer/HeaderDetails", authorization({
    resource: "agentDialer",
    action: "read"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[HeaderDetails] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));
        agentDialHandler.HeaderDetails(req, res);

    }
    catch (ex) {

        logger.error("[HeaderDetails] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[HeaderDetails] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get("/DVP/API/" + version + "/AgentDialer/Report/Disposition/Count", authorization({
    resource: "agentDialer",
    action: "read"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[agentDialerDispositionSummaryReportCount] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));


        agentDialHandler.agentDialerDispositionSummaryReportCount(req, res);

    }
    catch (ex) {

        logger.error("[agentDialerDispositionSummaryReportCount] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[agentDialerDispositionSummaryReportCount] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get("/DVP/API/" + version + "/AgentDialer/Report/Disposition", authorization({
    resource: "agentDialer",
    action: "read"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[CampaignDispositionReport] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));


        agentDialHandler.agentDialerDispositionSummaryReport(req, res);

    }
    catch (ex) {

        logger.error("[CampaignDispositionReport] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[CampaignDispositionReport] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get("/DVP/API/" + version + "/AgentDialer/Report/DispositionSummary", authorization({
    resource: "agentDialer",
    action: "read"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[CampaignDispositionSummaryReport] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));


        agentDialHandler.agentDialerAgentSummaryReport(req, res);

    }
    catch (ex) {

        logger.error("[CampaignDispositionSummaryReport] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[CampaignDispositionSummaryReport] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get("/DVP/API/" + version + "/AgentDialer/Report/Details/Disposition/Count", authorization({
    resource: "agentDialer",
    action: "read"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[agentDialerDispositionDetailsReportCount] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));


        agentDialHandler.agentDialerDispositionDetailsReportCount(req, res);

    }
    catch (ex) {

        logger.error("[agentDialerDispositionDetailsReportCount] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[agentDialerDispositionDetailsReportCount] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get("/DVP/API/" + version + "/AgentDialer/Report/Details/" +
    "Disposition", authorization({
    resource: "agentDialer",
    action: "read"
}), function (req, res, next) {
    var jsonString;
    try {

        logger.info("[agentDialerDispositionDetailsReport] - [HTTP]  - Request received -  Data - %s ", JSON.stringify(req.body));


        agentDialHandler.agentDialerDispositionDetailsReport(req, res);

    }
    catch (ex) {

        logger.error("[agentDialerDispositionDetailsReport] - [HTTP]  - Exception occurred -  Data - %s ", JSON.stringify(req.body), ex);
        jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, null);
        logger.debug("[agentDialerDispositionDetailsReport] - Request response : %s ", jsonString);
        res.end(jsonString);
    }
    return next();
});

//------------------------- Agent Dial Handler ------------------------- \\


