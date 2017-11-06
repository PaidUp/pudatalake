"use strict";

const service = require("./datalake.service");
const pmx = require("pmx");
const probe = pmx.probe();

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
  console.log(err);
  pmx.notify(err);
  counterSaveStripeRequestFail.inc();
  return res.status(500).json({ received: false });
}

module.exports = {
  saveStripeRequest: saveStripeRequest
};
