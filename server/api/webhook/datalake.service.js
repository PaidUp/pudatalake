"use strict";

const stripeService = require("../../services/stripe.service");
const dbService = require("../../services/db.service");
const moment = require("moment");
const config = require("../../config/environment");


function saveStripe(type, signature, body, cb) {
  let event = stripeService.getEvent(type, signature, body);
  let collectionName = (event && event.data && event.data.object && event.data.object.object) ? event.data.object.object : "undefined";
  dbService.connect((err, db) => {
    let collection = db.collection("stripe_"+collectionName);
    event.data.object["updated"] = moment().format("x");
    if(type){
      event.data.object["connect"] = event.account;
    } else {
      event.data.object["connect"] = config.stripe.account;
    }
    collection.findOneAndReplace({
      id: event.data.object.id, connect: event.data.object.connect
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