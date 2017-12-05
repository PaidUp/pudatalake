"use strict";

const dbService = require("../../services/db.service"),
  moment = require("moment"),
  config = require("../../config/environment"),
  schedule = require('node-schedule'),
  log = require("../../services/log.service"),
  axios = require("axios"),
  bugsnag = require("bugsnag");

var scheduler = {
  tickets: null,
  events: null
};
var isTicketsRunning, isEventsRunning = false;

function importZendeskTickets() {
  let colName = "zendesk_tickets";
  let rule = new schedule.RecurrenceRule();
  rule.minute = 25;
  scheduler.tickets = schedule.scheduleJob(rule, function () {
    if (!isTicketsRunning) {
      isTicketsRunning = true;
      dbService.connect((err, db) => {
        let collection = db.collection(colName);
        collection.find().sort({ generated_timestamp: -1 }).limit(1).toArray((err, result) => {
          let startDate = 1420070400;
          if (result.length) {
            startDate = result[0].generated_timestamp
          }
          retrieveIncremental(collection, "tickets", "organizations,comment_count", startDate, parseTicket, isTicketsRunning);
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

function retrieveIncremental(collectionDB, item, include, startTime, parseFunction, isRunning) {
  log.info(`retrieveIncremental ${item} - ${startTime}`);
  axios({
    method: 'get',
    url: `${config.zendesk.url}/api/v2/incremental/${item}.json?include=${include}&start_time=${startTime}`,
    auth: {
      username: config.zendesk.username,
      password: config.zendesk.password
    }
  }).then(function (response) {
    let data = response.data;
    let isLastPage = data.tickets.length <= 1;

    if (!isLastPage) {
      let nextStartDate = Number(data.next_page.split("=")[1]);
      persistIncremental(data[item], collectionDB, parseFunction, (err, result) => {
        if(err){
          bugsnag.notify(err);
          log.error(err);
          isRunning = false;
          return;
        }
        log.info('persist result: ' + result)
        retrieveIncremental(collectionDB, item, include, nextStartDate, parseFunction);
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

function persistIncremental(incrementals, collection, parseFunction, cb){
  let batch = collection.initializeOrderedBulkOp();
  for (let item of incrementals) {
    item = parseFunction(item);
    batch.find({ id: item.id, }).upsert().updateOne({ $setOnInsert: item });
  }
  batch.execute((err, exec) => {
    if (err) {
      log.error(err);
      cb(err);
      return;
    }
    cb(null, exec);
  });
}

function parseTicket(ticket){
  if(ticket.created_at){
    ticket.created_at = new Date(ticket.created_at)
  }
  if(ticket.updated_at){
    ticket.updated_at = new Date(ticket.updated_at)
  }
  return ticket;
}

function parseEvent(event){
  if(event.created_at){
    event.created_at = new Date(event.created_at)
  }
  for(let childEvent of event.child_events){
    if(childEvent.created_at){
      childEvent.created_at = new Date(event.created_at)
    }
  }
  return event;
}

module.exports = {
  importZendeskTickets: importZendeskTickets
};