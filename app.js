/**
 * Created by Rajinda on 05/18/2017.
 */

var restify = require('restify');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');

var config = require('config');

var port = config.Host.port || 3000;
var version = config.Host.version;
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var agentDialHandler = require('./AgentDialHandler');


//-------------------------  Restify Server ------------------------- \\
var RestServer = restify.createServer({
    name: "AgentDialerService",
    version: '1.0.0'
}, function (req, res) {

});
restify.CORS.ALLOW_HEADERS.push('api_key');
restify.CORS.ALLOW_HEADERS.push('authorization');

RestServer.use(restify.CORS());
RestServer.use(restify.fullResponse());
//Enable request body parsing(access)
RestServer.use(restify.bodyParser());
RestServer.use(restify.acceptParser(RestServer.acceptable));
RestServer.use(restify.queryParser());

// ---------------- Security -------------------------- \\
var jwt = require('restify-jwt');
var secret = require('dvp-common/Authentication/Secret.js');
var authorization = require('dvp-common/Authentication/Authorization.js');
RestServer.use(jwt({secret: secret.Secret}));
// ---------------- Security -------------------------- \\

//Server listen
RestServer.listen(port, function () {
    console.log('%s listening at %s', RestServer.name, RestServer.url);

});

//------------------------- End Restify Server ------------------------- \\



//------------------------- Agent Dial Handler ------------------------- \\

RestServer.post('/DVP/API/' + version + '/AgentDialer/Resource/:ResourceId/Dial', authorization({
    resource: "attribute",
    action: "write"
}), function (req, res, next) {
    try {

        logger.info('[SaveDialInfo] - [HTTP]  - Request received -  Data - %s ', JSON.stringify(req.body));

        if (!req.user ||!req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");

        agentDialHandler.SaveDialInfo(req,res);

    }
    catch (ex) {

        logger.error('[SaveDialInfo] - [HTTP]  - Exception occurred -  Data - %s ', JSON.stringify(req.body), ex);
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.debug('[SaveDialInfo] - Request response : %s ', jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get('/DVP/API/' + version + '/AgentDialer/Job/:jobId', authorization({
    resource: "attribute",
    action: "write"
}), function (req, res, next) {
    try {

        logger.info('[CheckStatus] - [HTTP]  - Request received -  Data - %s ', JSON.stringify(req.body));

        if (!req.user ||!req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");

        agentDialHandler.CheckStatus(req,res);

    }
    catch (ex) {

        logger.error('[CheckStatus] - [HTTP]  - Exception occurred -  Data - %s ', JSON.stringify(req.body), ex);
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.debug('[CheckStatus] - Request response : %s ', jsonString);
        res.end(jsonString);
    }
    return next();
});

RestServer.get('/DVP/API/' + version + '/AgentDialer/Job', authorization({
    resource: "attribute",
    action: "write"
}), function (req, res, next) {
    try {

        logger.info('[CheckStatus] - [HTTP]  - Request received -  Data - %s ', JSON.stringify(req.body));

        if (!req.user ||!req.user.tenant || !req.user.company)
            throw new Error("invalid tenant or company.");

        agentDialHandler.PendingJobList(req,res);

    }
    catch (ex) {

        logger.error('[CheckStatus] - [HTTP]  - Exception occurred -  Data - %s ', JSON.stringify(req.body), ex);
        var jsonString = messageFormatter.FormatMessage(ex, "EXCEPTION", false, undefined);
        logger.debug('[CheckStatus] - Request response : %s ', jsonString);
        res.end(jsonString);
    }
    return next();
});

//------------------------- Agent Dial Handler ------------------------- \\

//------------------------- Crossdomain ------------------------- \\

function Crossdomain(req, res, next) {


    var xml = '<?xml version=""1.0""?><!DOCTYPE cross-domain-policy SYSTEM ""http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd""> <cross-domain-policy>    <allow-access-from domain=""*"" />        </cross-domain-policy>';

    /*var xml='<?xml version="1.0"?>\n';

     xml+= '<!DOCTYPE cross-domain-policy SYSTEM "/xml/dtds/cross-domain-policy.dtd">\n';
     xml+='';
     xml+=' \n';
     xml+='\n';
     xml+='';*/
    req.setEncoding('utf8');
    res.end(xml);

}

function Clientaccesspolicy(req, res, next) {


    var xml = '<?xml version="1.0" encoding="utf-8" ?>       <access-policy>        <cross-domain-access>        <policy>        <allow-from http-request-headers="*" http-methods="*">        <domain uri="*"/>        </allow-from>        <grant-to>        <resource include-subpaths="true" path="/"/>        </grant-to>        </policy>        </cross-domain-access>        </access-policy>';
    req.setEncoding('utf8');
    res.end(xml);

}

RestServer.get("/crossdomain.xml", Crossdomain);
RestServer.get("/clientaccesspolicy.xml", Clientaccesspolicy);

//------------------------- End Crossdomain ------------------------- \\