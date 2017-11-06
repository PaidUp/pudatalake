"use strict";

const stripeService = require("../../services/stripe.service");
const dbService = require("../../services/db.service");
const moment = require("moment");


function saveStripe(signature, body, cb) {
  let event = stripeService.getEvent(signature, body);
  let collectionName = (event && event.data && event.data.object && event.data.object.object) ? event.data.object.object : "undefined";
  dbService.connect((err, db) => {
    let collection = db.collection("stripe_"+collectionName);
    event.data.object["updated"] = moment().format("x");
    collection.findOneAndReplace({
      id: event.data.object.id
    }, 
    event.data.object, {
      upsert: true
    }, (errdb, data) => {
      if (errdb) {
        cb(errdb);
      }
      cb(null, data);
    });
  });

}
module.exports = {
  saveStripe : saveStripe
};