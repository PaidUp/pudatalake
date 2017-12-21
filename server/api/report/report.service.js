"use strict";

const stripeService = require("../../services/stripe.service"),
  dbService = require("../../services/db.service"),
  log = require("../../services/log.service"),
  moment = require("moment"),
  bugsnag = require("bugsnag"),
  config = require("../../config/environment"),
  json2csv = require('json2csv'),
  schedule = require('node-schedule'),
  productionBalanceField = 56135508;


function schedulerMonthlySummary() {
  if(schedulerMonthlySummary.isRunning){
    log.info("schedulerMonthlySummary is running")
    return;
  }
  schedulerMonthlySummary.isRunning = true;
  schedulerMonthlySummary.instace = schedule.scheduleJob("* * * * *", () => {
    let firstDay = moment().date(1).subtract(1, 'months').toDate();
    getMonthlySummary(firstDay).then(doc => {
      if (!doc) {
        buildSummary(firstDay, (err, result) => {
          if (err) {
            log.error(err);
            bugsnag.notify(err);
            return;
          }
          let report = {
            name: "organization-monthly-summary",
            year: firstDay.getFullYear(),
            month: firstDay.getMonth(),
            craetedAt: new Date(),
            report: result
          };
          try {
            let dbc = null
            dbService.getAtlasConnection().then(db => {
              dbc = db;
              let collection = db.collection("report_results");

              collection.insertOne(report, (err, resp) => {
                if (err) {
                  log.error(err);
                  bugsnag.notify(err);
                  dbService.close(db, "schedulerMonthlySummary");
                  return;
                }
                log.info("Report saved: " + JSON.stringify(resp));
                dbService.close(db, "schedulerMonthlySummary");
              })
            })
          } catch (error) {
            log.error(error);
            bugsnag.notify(error);
            dbService.close(dbc, "schedulerMonthlySummary");
          }
        });
      }
    })

  })
}


function getMonthlySummary(firstDay) {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      let momentFirstDay = moment(firstDay);
      let filter = {
        name: "organization-monthly-summary",
        year: momentFirstDay.year(),
        month: momentFirstDay.month()
      };
      dbService.getAtlasConnection().then(db => {
        dbc = db;
        let collection = db.collection("report_results");
        collection.findOne(filter, (err, doc) => {
          if (err) {
            log.error(err);
            bugsnag.notify(err);
            dbService.close(db, "getMonthlySummary");
            return reject(err);
          }
          dbService.close(db, "getMonthlySummary");
          resolve(doc)
        });
      }).catch(reason => {
        log.error(reason);
        bugsnag.notify(reason);
        dbService.close(dbc, "getMonthlySummary");
        reject(reason);
      })
    } catch (error) {
      log.error(error);
      bugsnag.notify(error);
      dbService.close(dbc, "getMonthlySummary");
      reject(error);
    }
  });
}

function getMonthlySummaryCSV(firstDate){
  return new Promise((resolve, reject) => {
    getMonthlySummary(firstDate).then(doc => {
      let result = doc ? json2csv(doc.report) : "";
      resolve(result);
    }).catch(reason => {
      reject(reason);
    })
  });
}

function buildSummary(firstDate, cb) {
  //[touches, outstanding, aged, failed]
  let fields = ["id", "name", "email", "organization", "touches", "outstanding", "aged", "failed", "deposits", "cashflow"];
  Promise.all([
    getTouches(firstDate),
    reduceAmounts(["ticket_category_adjust_payment_amount_and_or_date", "ticket_category_sign_up_assistance", "ticket_category_setup_unique_payment_plan"], ["open", "pending"]),
    reduceAmounts(["ticket_category_no_response_unable_to_collect_payment"], ["solved", "closed"], firstDate),
    reduceAmounts(["ticket_category_payment_failed_new_card"], ["open", "pending"]),
    getDeposits(firstDate),
    getCashFlow(firstDate),
    getSummaryRecipients()
  ]).then(values => {
    let touches = values[0];
    let outstanding = values[1];
    let aged = values[2];
    let failed = values[3];
    let deposits = values[4];
    let cashflow = values[5];
    let summaryRecipients = values[6];
    getOrganizations().then(orgs => {
      let rows = [];
      for (let org of orgs) {
        let row = {
          id: org.id,
          organization: org.name,
          touches: 0,
          outstanding: 0,
          aged: 0,
          failed: 0,
          deposits: 0,
          cashflow: 0
        };

        for (let ele of touches) {
          if (ele._id === org.zenDeskId) {
            row.touches = ele.touch;
            break;
          }
        }

        for (let ele of outstanding) {
          if (ele._id === org.zenDeskId) {
            row.outstanding = ele.amount.toFixed(2);
            break;
          }
        }

        for (let ele of aged) {
          if (ele._id === org.zenDeskId) {
            row.aged = ele.amount.toFixed(2);
            break;
          }
        }

        for (let ele of failed) {
          if (ele._id === org.zenDeskId) {
            row.failed = ele.amount.toFixed(2);
            break;
          }
        }

        for (let ele of deposits) {
          if (ele._id === org.stripeId) {
            row.deposits = (ele.amount / 100).toFixed(2);
            break;
          }
        }

        for (let key in cashflow) {
          if (key === org.stripeId) {
            row.cashflow = cashflow[key].toFixed(2);
            break;
          }
        }

        rows.push(row);
      }
      let rowsWhitRec = [];

      for (let organization of summaryRecipients.organizations) {
        for (let row of rows) {
          if (row.id === organization.organizationId) {
            for (let recipient of organization.recipients) {
              let newRow = JSON.parse(JSON.stringify(row));
              newRow["name"] = recipient.name;
              newRow["email"] = recipient.email;
              rowsWhitRec.push(newRow);
            }
          }
        }
      }
      var result = { data: rowsWhitRec, fields: fields };
      cb(null, result);

    }).catch(reason => {
      handlerError(reason, cb);
    })
  });
}

function getTouches(firstDate) {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      let startDate = firstDate;
      let endDate = moment(firstDate).add(1, 'months').toDate();
      dbService.getAtlasConnection().then(db => {
        dbc = db;
        db.collection("zendesk_tickets").aggregate([
          {
            $match: {
              "updated_at": {
                $gte: startDate,
                $lte: endDate
              }
            }
          },
          {
            $lookup:
              {
                from: "zendesk_ticket_events",
                localField: "id",
                foreignField: "ticket_id",
                as: "events"
              }
          },
          { $unwind: "$events" },
          {
            $match: {
              "events.created_at": {
                $gte: startDate,
                $lte: endDate
              },
              "events.child_events": {
                $elemMatch: { type: "Comment" }
              }
            }
          },
          {
            $group: {
              _id: "$organization_id",
              "touch": { $sum: 1 }
            }
          }

        ]).toArray((err, docs) => {
          if (err) {
            return handlerError(err, reject, dbc);
          }
          dbService.close(db, "getTouches");
          resolve(docs)
        });

      }).catch(reason => {
        handlerError(reason, reject, dbc);
      });
    } catch (error) {
      handlerError(error, reject, dbc);
    }
  })

}

function reduceAmounts(fields, status, firstDate) {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      dbService.getAtlasConnection().then(db => {
        dbc = db;
        let match = {
          $match: {
            fields: {
              $elemMatch: {
                value: { $in: fields }
              }
            },
            status: {
              $in: status
            }
          }
        }
        if (firstDate) {
          let endDate = moment(firstDate).add(1, 'months').toDate();
          match.$match["updated_at"] = {
            $gte: firstDate,
            $lte: endDate
          }
        }
        db.collection("zendesk_tickets").aggregate([
          match,
          { $unwind: "$fields" },
          {
            $match: {
              "fields.id": productionBalanceField
            }
          },
          {
            $group: {
              _id: "$organization_id",
              "values": { $push: "$fields.value" }
            }
          }
        ]).toArray((err, docs) => {
          if (err) {
            return handlerError(err, reject, dbc);
          }
          let res = docs.map(elem => {
            var sum = elem.values.reduce((prevVal, val) => {
              return prevVal + new Number(val);
            }, 0);
            return {
              _id: elem._id,
              amount: sum
            }
          })
          dbService.close(db, "reduceAmounts");
          resolve(res)
        });
      }).catch(reason => {
        handlerError(reason, reject, dbc);
      });
    } catch (error) {
      handlerError(error, reject, dbc);
    }
  })
}

function getDeposits(firstDate) {
  return new Promise((resolve, reject) => {
    try {
      let startDate = moment(firstDate).unix();
      let endDate = moment(firstDate).add(1, 'months').unix();
      reduceDeposits(startDate, endDate).then(result => {
        resolve(result);
      }).catch(reason => {
        handlerError(reason, reject);
      })
    } catch (error) {
      handlerError(error, reject);
    }
  })
}

function reduceDeposits(startDate, endDate) {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      dbService.getAtlasConnection().then(db => {
        dbc = db;
        db.collection("stripe_payout").aggregate([
          {
            $match: {
              status: "paid",
              arrival_date: {
                $gte: startDate, $lte: endDate
              }
            }
          },
          {
            $group: {
              _id: "$connect",
              "amount": { $sum: "$amount" }
            }
          }
        ]).toArray((err, docs) => {
          if (err) {
            return handlerError(err, reject, dbc);
          }
          dbService.close(db, "reduceDeposits");
          resolve(docs)
        });

      }).catch(reason => {
        handlerError(reason, reject, dbc);
      });
    } catch (error) {
      handlerError(error, reject, dbc);
    }
  })
}

function getOrganizations() {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      dbService.getAtlasConnection().then(db => {
        dbc = db;
        db.collection("organizations").find({}).toArray(function (err, docs) {
          if (err) {
            return handlerError(err, reject, dbc);
          }
          dbService.close(db, "getOrganizations");
          resolve(docs);
        });
      }).catch(reason => {
        handlerError(reason, reject, dbc);
      });
    } catch (error) {
      handlerError(error, reject, dbc);
    }
  })
}

function getCashFlow(firstDate) {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      let since = moment(firstDate).add(1, 'months').toDate();
      dbService.getLocalConnection().then(db => {
        dbc = db;
        db.collection('orders').aggregate([
          {
            $unwind: "$paymentsPlan"
          },
          {
            $match: {
              "paymentsPlan.status": "pending",
              "paymentsPlan.dateCharge": {
                $gte: since
              },
            }
          }
        ]).toArray((err, docs) => {
          if (err) {
            return handlerError(err, reject, dbc);
          }
          let map = docs.map(order => {
            return {
              _id: order.paymentsPlan.destinationId,
              amount: order.paymentsPlan.price - order.paymentsPlan.totalFee
            }
          }).reduce((prev, curr) => {
            prev[curr._id] = curr.amount + (prev[curr._id] || 0);
            return prev;
          }, {});
          dbService.close(db, "getCashFlow");
          resolve(map);
        });
      }).catch(reason => {
        handlerError(reason, reject, dbc);
      });
    } catch (error) {
      handlerError(error, reject, dbc);
    }
  });
}

function getSummaryRecipients() {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      dbService.getAtlasConnection().then(db => {
        dbc = db
        db.collection("reports").findOne({ id: "organization-monthly-summary" }, (err, report) => {
          if (err) {
            return handlerError(err, reject, dbc);
          }
          dbService.close(db, "getSummaryRecipients");

          resolve(report)
        });
      }).catch(reason => {
        handlerError(reason, reject, dbc);
      });
    } catch (error) {
      handlerError(error, reject, dbc);
    }
  });
}

function handlerError(reason, reject, db) {
  log.error(reason);
  bugsnag.notify(reason);
  reject(reason);
  dbService.close(db);
}

module.exports = {
  getMonthlySummaryCSV: getMonthlySummaryCSV,
  schedulerMonthlySummary, schedulerMonthlySummary
};