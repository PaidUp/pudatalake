"use strict";

const stripeService = require("../../services/stripe.service"),
  dbService = require("../../services/db.service"),
  log = require("../../services/log.service"),
  moment = require("moment"),
  bugsnag = require("bugsnag"),
  businessDays = require("../../services/businessDays"),
  config = require("../../config/environment"),
  json2csv = require('json2csv');

function getSummary(year, month, cb) {
  //[touches, outstanding, aged, failed]
  let fields = ["id", "organization", "touches", "outstanding", "aged", "failed", "deposits", "cashflow"];
  Promise.all([
    getTouches(year, month),
    reduceAmounts(["ticket_category_adjust_payment_amount_and_or_date", "ticket_category_sign_up_assistance", "ticket_category_setup_unique_payment_plan"], ["open", "pending"]),
    reduceAmounts(["ticket_category_no_response_unable_to_collect_payment"], ["solved", "closed"]),
    reduceAmounts(["ticket_category_payment_failed_new_card"], ["open", "pending"]),
    getDeposits(parseInt(year), parseInt(month) - 1, 1),
    getCashFlow(parseInt(year), parseInt(month) - 1)
  ]).then(values => {
    let touches = values[0];
    let outstanding = values[1];
    let aged = values[2];
    let failed = values[3];
    let deposits = values[4];
    let cashflow = values[5];
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
          }
        }

        for (let ele of outstanding) {
          if (ele._id === org.zenDeskId) {
            row.outstanding = ele.amount.toFixed(2);
          }
        }

        for (let ele of aged) {
          if (ele._id === org.zenDeskId) {
            row.aged = ele.amount.toFixed(2);
          }
        }

        for (let ele of failed) {
          if (ele._id === org.zenDeskId) {
            row.failed = ele.amount.toFixed(2);
          }
        }

        for (let ele of deposits) {
          if (ele._id === org.stripeId) {
            row.deposits = ele.amount.toFixed(2);
          }
        }

        for (let key in cashflow) {
          if (key === org.stripeId) {
            row.cashflow = cashflow[key].toFixed(2);
          }
        }

        rows.push(row);
      }
      var result = json2csv({ data: rows, fields: fields });
      cb(null, result);

    }).catch(reason => {
      handlerError(reason, cb);
    })
  });
}

function getTouches(year, month) {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      let startDate = new Date(`${year}-${month}-01T00:00:00.0Z`);
      let endDate = new Date(`${year}-${month}-01T00:00:00.0Z`);
      endDate.setMonth(startDate.getMonth() + 1);
      endDate.setDate(0);
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
          dbService.close(db);
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

function reduceAmounts(fields, status) {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      dbService.getAtlasConnection().then(db => {
        dbc = db;
        db.collection("zendesk_tickets").aggregate([
          {
            $match: {
              $and: [
                {
                  fields: {
                    $elemMatch: {
                      $and:
                        [
                          { id: 56135508 },
                          { value: { $ne: null } },

                        ]
                    }
                  }
                },
                {
                  fields: {
                    $elemMatch: {
                      $and:
                        [
                          { id: 31717498 },
                          { value: { $in: fields } },

                        ]
                    }
                  }
                },
                {
                  status: {
                    $in: status
                  }
                }
              ]
            }
          },
          { $unwind: "$fields" },
          {
            $match: {
              "fields.id": 56135508
            }
          },
          {
            $group: {
              _id: "$organization_id",
              "values": { $push: "$fields.value" }
            }
          },
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
          dbService.close(db);
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

function getDeposits(year, month) {
  return new Promise((resolve, reject) => {
    try {
      let startDate = moment({ y: year, M: month, d: 1, h: 0 }).unix();
      let endDate = moment({ y: year, M: month, d: 1, h: 0 }).add(1, 'months').unix();
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
          dbService.close(db);
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
          dbService.close(db);
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

function getCashFlow(year, month) {
  return new Promise((resolve, reject) => {
    let dbc = null;
    try {
      let since = moment({ y: year, M: month, d: 1, h: 0 }).add(1, 'months');
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
                $gte: since.toDate()
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
          dbService.close(db);
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
        db.collection("reports").find({ id: "organization-monthly-summary" }, (err, report) => {
          if (err) {
            return handlerError(err, reject, dbc);
          }
          dbService.close(db);
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
  getSummary: getSummary
};