"use strict";

const MongoClient = require("mongodb").MongoClient;
const url = require("../config/environment").mongo.uri;
const pmx = require("pmx");
const logger = require("./log.service");

function handlerDB(cb) {
  if (handlerDB.db && handlerDB.db.serverConfig && handlerDB.db.serverConfig.isConnected()) {
    return cb(null, handlerDB.db);
  }
  MongoClient.connect(url, function (err, db) {
    if (err) {
      pmx.notify(err);
      return cb(err);
    }
    logger.info("Connected successfully to server");
    handlerDB.db = db;
    cb(null, handlerDB.db);
  });
}

exports.connect = function (cb) {
  handlerDB(cb);
};