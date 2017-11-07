"use strict";

const compression = require("compression");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const cookieParser = require("cookie-parser");
var bugsnag = require("bugsnag");

module.exports = function (app) {
  app.use(compression());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(methodOverride());
  app.use(cookieParser());
  app.use(bugsnag.requestHandler);
  app.use(bugsnag.errorHandler);
};
