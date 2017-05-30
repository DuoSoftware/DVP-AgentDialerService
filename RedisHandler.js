/**
 * Created by Waruna on 5/24/2017.
 */




/*var format = require("stringformat");*/
var config = require("config");
var redis = require("redis");
var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redisClient = redis.createClient(redisport, redisip);
var messageFormatter = require("dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js");
/*var logger = require("dvp-common/LogHandler/CommonLogHandler.js").logger;*/

redisClient.auth(config.Redis.password, function (err) {
    /*if (err)
     throw err;*/
    console.error("Redis Auth error ", err);
});

redisClient.on("error", function (err) {
    console.error("Redis connection error ", err);
});

redisClient.on("connect", function (err) {
    if(err){
        console.error(err);
    }
    redisClient.select(config.Redis.redisdb, redis.print);
});

module.exports.collectJobList = function (company, iss, jobId) {


    /* companyUserCollection[req.user.company].push(req.user.iss);
     companyCollection[req.user.iss].push(jobId);*/


    redisClient.hmset(company, [iss, iss], function (err, res) {
        if (err) {
            console.error("Err :", jobId);
        } else {
            console.log("Done ", res);
        }
    });

    redisClient.hmset(iss, [jobId, jobId], function (err, res) {
        if (err) {
            console.error("Err :", jobId);
        } else {
            console.log("Done ", res);
        }
    });


};

module.exports.pendingJobList = function (iss, res) {


    /* companyUserCollection[req.user.company].push(req.user.iss);
     companyCollection[req.user.iss].push(jobId);*/

    redisClient.HGETALL(iss, function (err, reuslt) {
        var jsonString;
        if (err) {
            jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
        }
        else {
            if(reuslt){
                var out = Object.keys(reuslt).map(function (data) {
                    return data;
                });
                jsonString = messageFormatter.FormatMessage(null, "SUCCESS", true, out);
            }
            else {
                jsonString = messageFormatter.FormatMessage(null, "SUCCESS", false, null);
            }

        }
        res.end(jsonString);
    });
};

module.exports.deleteJob = function (iss, jobId) {

    redisClient.HDEL(iss, jobId, function (err, reuslt) {

        if (err) {
            console.log(messageFormatter.FormatMessage(err, "EXCEPTION", false, null));
        }
        else {
            if (reuslt === 0) {
                redisClient.HDEL(iss, function (err, reuslt) {
                    if(err){
                        console.error(err);
                    }
                    else{
                        console.log("Complete Job", reuslt);
                    }

                });
            }
        }

    });
};

module.exports.DeletePendingJob = function (req, res) {

    if (!req.user || !req.user.tenant || !req.user.company) {
        throw new Error("invalid tenant or company.");
    }

    var jobId = req.body.JobId;
    var iss =req.user.iss ;

    if (jobId) {
        redisClient.HDEL(iss, jobId, function (err, reuslt) {
            var jsonString;
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
            }
            else {
                if (reuslt === 0) {
                    redisClient.DEL(iss, function (err, reuslt) {
                        if(err){
                            console.error(err);
                        }
                        else{
                            console.log("Complete Job", reuslt);
                        }
                    });
                }
                jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, null);
            }
            res.end(jsonString);
        });
    }
    else{
        redisClient.DEL(iss, function (err, reuslt) {
            var jsonString;
            if (err) {
                jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, null);
            }
            else {
                jsonString = messageFormatter.FormatMessage(null, "EXCEPTION", true, reuslt);
            }
            res.end(jsonString);
        });
    }
};