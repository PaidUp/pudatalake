"use strict";

const dbService = require("../../services/db.service"),
  moment = require("moment"),
  config = require("../../config/environment"),
  schedule = require('node-schedule'),
  log = require("../../services/log.service"),
  axios = require("axios"),
  bugsnag = require("bugsnag"),
  zdExportConfig = config.zendesk.export;

var scheduler = {};
var pid = { tickets: false, ticket_events: false, ticket_metric_events: false };


function importZendeskTickets() {
  importZendesk("tickets", "comment_count");
  importZendesk("ticket_events", "comment_events");
  importZendesk("ticket_metric_events");
}

function importZendesk(item, include) {
  let colName = "zendesk_" + item;;
  let rule = new schedule.RecurrenceRule();
  rule.minute = zdExportConfig[item].minute;
  scheduler[item] = schedule.scheduleJob(rule, function () {
    if (!pid[item]) {
      pid[item] = true;
      dbService.connect((err, db) => {
        let collection = db.collection(colName);
        let filter = {};
        filter[startTime[item].attribute] = -1;
        collection.find().sort(filter).limit(1).toArray((err, result) => {
          let start = 1420070400;
          if (result.length) {
            start = startTime[item].get(result[0]) - 5184000;
          }
          let includeQuery = include ? `include=${include}&` : "";
          let url = `${config.zendesk.url}/api/v2/incremental/${item}.json?${includeQuery}start_time=${start}`
          retrieveIncremental(collection, url, item);
        });
      });
    } else {
      log.info("is running - "+ item);
    }
  });


}

function retrieveIncremental(collectionDB, url, item) {
  log.info(`retrieveIncremental ${url}`);
  axios({
    method: 'get',
    url: url,
    auth: {
      username: config.zendesk.username,
      password: config.zendesk.password
    }
  }).then(function (response) {
    let data = response.data;
    let isLastPage = data.count < zdExportConfig[item].count;
    persistIncremental(data[item], item, collectionDB, (err, result) => {
      if (err) {
        bugsnag.notify(err);
        log.error(err);
        pid[item] = false;
        return;
      }
      log.info('persist result: ' + JSON.stringify(result));
      if (isLastPage) {
        pid[item] = false;
        log.info("##end - " + item)
      } else {
        retrieveIncremental(collectionDB, data.next_page, item);
      }
    });


  }).catch(function (error) {
    pid[item] = false;
    log.error(error);
    bugsnag.notify(error);
  });

}

function persistIncremental(incrementals, item, collection, cb) {
  let batch = collection.initializeOrderedBulkOp();
  for (let ele of incrementals) {
    ele = parseMethod[item](ele);
    batch.find({ id: ele.id, }).upsert().updateOne({ $setOnInsert: ele });
  }
  batch.execute((err, result) => {
    if (err) {
      log.error(err);
      cb(err);
      return;
    }
    cb(null, {
      nInserted: result.nInserted,
      nUpserted: result.nUpserted,
      nMatched: result.nMatched,
      nModified: result.nModified,
      nRemoved: result.nRemoved
    });
  });
}

var parseMethod = {
  tickets: function (ticket) {
    if (ticket.created_at) {
      ticket.created_at = new Date(ticket.created_at)
    }
    if (ticket.updated_at) {
      ticket.updated_at = new Date(ticket.updated_at)
    }
    return ticket;
  },
  ticket_events: function parseEvent(event) {
    if (event.created_at) {
      event.created_at = new Date(event.created_at)
    }
    for (let childEvent of event.child_events) {
      if (childEvent.created_at) {
        childEvent.created_at = new Date(event.created_at)
      }
    }
    return event;
  },
  ticket_metric_events: function (metric) {
    if (metric.time) {
      metric.time = new Date(metric.time)
    }
    return metric;
  }
}

var startTime = {
  tickets: {
    attribute: "generated_timestamp",
    get: function (ticket) {
      return ticket.generated_timestamp;
    }
  },
  ticket_events: {
    attribute: "timestamp",
    get: function (event) {
      return event.timestamp;
    }
  },
  ticket_metric_events: {
    attribute: "time",
    get: function (metric) {
      return moment(metric.time).unix();
    }
  }
}

module.exports = {
  importZendeskTickets: importZendeskTickets
};