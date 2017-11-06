"use strict";

const config = require("../config/environment");
const endpointSecret = config.stripe.webhook.datalake;

function instance (){
  if(!instance.stripe){
    instance.stripe = require ("stripe")(config.stripe.key);
  }
  return instance.stripe;
}

function getEvent(sig, body){
  return instance().webhooks.constructEvent(body, sig, endpointSecret);
}

module.exports = {
  instance : instance,
  getEvent : getEvent
};
