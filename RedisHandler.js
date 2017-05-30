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
    console.log("Redis Auth error  {0}", err);
});

redisClient.on("error", function (err) {
    console.log("Redis connection error  {0}", err);
});

redisClient.on("connect", function (err) {
    if(err){
        console.log(err);
    }
    redisClient.select(config.Redis.redisdb, redis.print);
});

module.exports.CollectJobList = function (company, iss, jobId) {


    /* companyUserCollection[req.user.company].push(req.user.iss);
     companyCollection[req.user.iss].push(jobId);*/


    redisClient.hmset(company, [iss, iss], function (err, res) {
        if (err) {
            console.log("Err {0} {1} {2}",company,iss,jobId);
        } else {
            console.log("Done {0} {1} {2} {3}", company, iss,jobId,res);
        }
    });

    redisClient.hmset(iss, [jobId, jobId], function (err, res) {
        if (err) {
            console.log("Err {0} {1} {2}",company,iss,jobId);
        } else {
            console.log("Done {0} {1} {2} {3}", company, iss,jobId,res);
        }
    });


};

module.exports.PendingJobList = function (iss, res) {


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

module.exports.DeleteJob = function (iss, jobId) {

    redisClient.HDEL(iss, jobId, function (err, reuslt) {

        if (err) {
            console.log(messageFormatter.FormatMessage(err, "EXCEPTION", false, null));
        }
        else {
            if (reuslt === 0) {
                redisClient.HDEL(iss, function (err, reuslt) {
                    if(err){
                        console.log(err);
                    }
                    else{
                        console.log("Complete Job"+reuslt);
                    }

                });
            }
        }

    });
};

module.exports.DeletePendingJob = function (req, res) {


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
                            console.log(err);
                        }
                        else{
                            console.log("Complete Job"+reuslt);
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