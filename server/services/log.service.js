"use strict";

var bugsnag = require("bugsnag");
//const config = require("../config/environment");
const winston = require("winston");
//require("winston-loggly-bulk");
var logger = new (winston.Logger)({});

if (process.env.NODE_ENV === "test") {
  logger.add(winston.transports.File, { filename: "logs/test.log" });
} else if (process.env.NODE_ENV === "development") {
  logger.add(winston.transports.Console);
  //logger.add(winston.transports.Loggly, config.logger.loggly);  
} else {
  logger.add(winston.transports.Console);  
  //logger.add(winston.transports.Loggly, config.logger.loggly);
}

function info (message) {
  logger.log("info", message);
}

function debug (message) {
  logger.log("debug", message);
}

function error (message) {
  bugsnag.notify(message);
  logger.log("error", message);
}

function warn (message) {
  logger.log("warn", message);
}

module.exports = {
  info : info,
  debug: debug,
  error: error,
  warn: warn
};

