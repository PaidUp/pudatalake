/**
 * Main application file
 */

"use strict";

process.env.NODE_ENV = process.env.NODE_ENV || "development";

const pmx = require("pmx").init({
  http: true, // HTTP routes logging (default: true)
  ignore_routes: [/socket\.io/, /notFound/], // Ignore http routes with this pattern (Default: [])
  errors: true, // Exceptions loggin (default: true)
  custom_probes: true, // Auto expose JS Loop Latency and HTTP req/s as custom metrics
  network: true, // Network monitoring at the application level
  ports: true, // Shows which ports your app is listening on (default: false)
  alert_enabled: true
});

const express = require("express"),
config = require("./config/environment"),
DbService = require("./services/db.service"),
logger = require("./services/log.service"),
bugsnag = require("bugsnag"),
zendeskService = require("./api/schedule/zendesk.service");


bugsnag.register(config.bugsnag);

DbService.connect((err, db) => {
  if(err){
    return logger.error(err);
  }
  logger.info("Connected to mongo database");
});


const app = express();
const server = require("http").createServer(app);
require("./config/express")(app);
require("./routes")(app);

// Start server
if (config.env != "test") {
  try {
    server.listen(config.port, config.ip, function () {
      logger.info(`Express server listening on ${config.port}, in ${app.get("env")} mode`);
      zendeskService.importZendeskTickets();
    });
  } catch (err) {
    bugsnag.notify(err);
    logger.error(err);
  }
}

exports = module.exports = app;
