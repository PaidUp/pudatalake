"use strict";

const service = require("./report.service"),
moment = require("moment"),
pmx = require("pmx"),
logger = require("../../services/log.service");




function organizationMonthlySummary(req, res) {
  try {
    let year = req.params.year;
    let month = req.params.month;
    let firstDate = moment(`${year}-${month}-01`).toDate();
    
    service.getMonthlySummaryCSV(firstDate).then(data => {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=summary.csv');
      res.status(200).send(data)
    }).catch(reason => {
      handlerError(reason, res);
    });
  } catch (error) {
    handlerError(error, res);
  }
}

function handlerError(err, res) {
  pmx.notify(err);
  logger.error(err);
  return res.status(500).json({ received: false });
}

module.exports = {
  organizationMonthlySummary: organizationMonthlySummary
};
