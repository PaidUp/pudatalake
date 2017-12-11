"use strict";

const service = require("./report.service");
const pmx = require("pmx");
const logger = require("../../services/log.service");




function organizationMonthlySummary (req, res){
  try {
    console.log("organizationMonthlySummary");
    service.getSummary();
    res.status(200).end()
  } catch (error) {
    handlerError(error, res);
  }
}

function handlerError (err, res){
  pmx.notify(err);
  counterSaveStripeRequestFail.inc();
  logger.error(err);  
  return res.status(500).json({ received: false });
}

module.exports = {
  organizationMonthlySummary: organizationMonthlySummary
};
