"use strict";

const MongoClient = require("mongodb").MongoClient,
mongoConf = require("../config/environment").mongo,
logger = require("./log.service");

function handlerDB(cb) {
  if (handlerDB.db && handlerDB.db.serverConfig && handlerDB.db.serverConfig.isConnected()) {
    return cb(null, handlerDB.db);
  }
  MongoClient.connect(mongoConf.atlas, function (err, db) {
    if (err) {
      pmx.notify(err);
      return cb(err);
    }
    logger.info("Connected successfully to server");
    handlerDB.db = db;
    cb(null, handlerDB.db);
  });
}

function getConnection (url) {
  return new Promise( (resolve, reject) => {
    try {
      MongoClient.connect(url, (err, db) => {
        if (err) {
          pmx.notify(err);
          return reject(err);
        }
        logger.info("Connected successfully to server");
        resolve(db);
      });
    } catch (error) {
      reject(error);
    }
  });
}

exports.close = function(db){
  if (db && db.serverConfig && db.serverConfig.isConnected()) {
    logger.info("close connection server");
    db.close();
  }
}

exports.getLocalConnection = function (){
  let url = mongoConf.local
  return getConnection(url);
}

exports.getAtlasConnection = function(){
  let url = mongoConf.atlas
  return getConnection(url);
}

exports.connect = function (cb) {
  handlerDB(cb);
};