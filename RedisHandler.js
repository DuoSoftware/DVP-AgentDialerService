/**
 * Created by Waruna on 5/24/2017.
 */




/*var format = require("stringformat");*/
var config = require("config");
var redis = require("ioredis");
var messageFormatter = require("dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js");
/*var logger = require("dvp-common/LogHandler/CommonLogHandler.js").logger;*/

var redisip = config.Redis.ip;
var redisport = config.Redis.port;
var redispass = config.Redis.password;
var redismode = config.Redis.mode;
var redisdb = config.Redis.db;



var redisSetting =  {
    port:redisport,
    host:redisip,
    family: 4,
    password: redispass,
    db: redisdb,
    retryStrategy: function (times) {
        var delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: function (err) {

        return true;
    }
};

if(redismode == 'sentinel'){

    if(config.Redis.sentinels && config.Redis.sentinels.hosts && config.Redis.sentinels.port && config.Redis.sentinels.name){
        var sentinelHosts = config.Redis.sentinels.hosts.split(',');
        if(Array.isArray(sentinelHosts) && sentinelHosts.length > 2){
            var sentinelConnections = [];

            sentinelHosts.forEach(function(item){

                sentinelConnections.push({host: item, port:config.Redis.sentinels.port})

            })

            redisSetting = {
                sentinels:sentinelConnections,
                name: config.Redis.sentinels.name,
                password: redispass
            }

        }else{

            console.log("No enough sentinel servers found .........");
        }

    }
}

var redisClient = undefined;

if(redismode != "cluster") {
    redisClient = new redis(redisSetting);
}else{

    var redisHosts = redisip.split(",");
    if(Array.isArray(redisHosts)){


        redisSetting = [];
        redisHosts.forEach(function(item){
            redisSetting.push({
                host: item,
                port: redisport,
                family: 4,
                password: redispass});
        });

        var redisClient = new redis.Cluster([redisSetting]);

    }else{

        redisClient = new redis(redisSetting);
    }


}


redisClient.on("error", function (err) {
    console.error("Redis connection error ", err);
});

redisClient.on("connect", function (err) {
    if(err){
        console.error(err);
    }

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
