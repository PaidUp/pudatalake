"use strict";

const dbService = require("../../services/db.service"),
  moment = require("moment"),
  config = require("../../config/environment"),
  schedule = require('node-schedule'),
  log = require("../../services/log.service"),
  axios = require("axios");

var scheduler = null;
var isRunning = false;

function importZendeskTickets() {
  var rule = new schedule.RecurrenceRule();
  rule.minute = 60;
  scheduler = schedule.scheduleJob(rule, function () {
    if (!isRunning) {
      isRunning = true;
      dbService.connect((err, db) => {
        let collection = db.collection("zendesk_tickets");
        db.collection("zendesk_tickets").find().sort({ generated_timestamp: -1 }).limit(1).toArray((err, result) => {
          let startDate = 1420070400;
          if (result.length) {
            startDate = result[0].generated_timestamp
          }
          getTickets(collection, startDate);
        });
      });
    } else {
      log.info("is running")
    }
  });


}

function getTickets(collection, startTime) {
  log.info("start getTickets");
  axios({
    method: 'get',
    url: `${config.zendesk.url}/api/v2/incremental/tickets.json?start_time=${startTime}`,
    auth: {
      username: config.zendesk.username,
      password: config.zendesk.password
    }
  }).then(function (response) {
    let data = response.data;
    let isLastPage = data.tickets.length <= 1;

    if (!isLastPage) {
      let nextStartDate = Number(data.next_page.split("=")[1]);

      let batch = collection.initializeOrderedBulkOp();
      for (let ticket of data.tickets) {
        batch.find({ id: ticket.id, }).upsert().updateOne({ $setOnInsert: ticket });
      }
      batch.execute((err, exec) => {
        if (err) {
          log.error(err);
          isRunning = false;
          return;
        }
        log.info('nextStartDate: ' + nextStartDate)
        getTickets(collection, nextStartDate);
      });
    } else {
      isRunning = false;
      log.info("##end##")
    }

  }).catch(function (error) {
    bugsnag.notify(error);
    log.error(error);
  });

}

module.exports = {
  importZendeskTickets: importZendeskTickets
};