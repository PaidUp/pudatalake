"use strict";

const service = require("./report.service");
const pmx = require("pmx");
const logger = require("../../services/log.service");




function organizationMonthlySummary(req, res) {
  try {
    let year = req.params.year;
    let month = req.params.month;
    
    service.getSummary(year, month, (err, data) => {
      if (err) {
        handlerError(error, res);
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=summary.csv');
      res.status(200).send(data)
    });
  } catch (error) {
    handlerError(error, res);
  }
}

function handlerError(err, res) {
  pmx.notify(err);
  counterSaveStripeRequestFail.inc();
  logger.error(err);
  return res.status(500).json({ received: false });
}

module.exports = {
  organizationMonthlySummary: organizationMonthlySummary
};
