"use strict";

const config = require("../config/environment");
const winston = require("winston");
require("winston-loggly-bulk");

winston.add(winston.transports.Loggly, config.logger.loggly);

function info (message) {
  winston.log("info", message);
}

function debug (message) {
  winston.log("debug", message);
}

function error (message) {
  winston.log("error", message);
}

function warn (message) {
  winston.log("warn", message);
}

module.exports = {
  info : info,
  debug: debug,
  error: error,
  warn: warn
};

