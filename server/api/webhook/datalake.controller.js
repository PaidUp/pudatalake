"use strict";

const service = require("./datalake.service");
const pmx = require("pmx");
const probe = pmx.probe();
const logger = require("../../services/log.service");

var counterSaveStripeRequest = probe.counter({
  name : "saveStripeRequest"
});
var counterSaveStripeRequestFail = probe.counter({
  name : "saveStripeRequestFail"
});


function saveStripeRequest (req, res){
  try {
    let sig = req.headers["stripe-signature"];
    service.saveStripe(sig, req.body, (err, data) => {
      if(err){
        return handlerError(err, res);
      }
      counterSaveStripeRequest.inc();
      res.status(200).end();
    });
  } catch (error) {
    handlerError(error, res);
  }
}

function handlerError (err, res){
  pmx.notify(err);
  counterSaveStripeRequestFail.inc();
  if(err.type && err.type === "StripeSignatureVerificationError"){
    logger.warn(err);
    return res.status(401).end();
  }
  logger.error(err);  
  return res.status(500).json({ received: false });
}

module.exports = {
  saveStripeRequest: saveStripeRequest
};
