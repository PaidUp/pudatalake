"use strict";

const stripeService = require("../../services/stripe.service"),
  dbService = require("../../services/db.service"),
  log = require("../../services/log.service"),
  moment = require("moment"),
  config = require("../../config/environment");

function getSummary() {
  //[touces, outstanding, aged, failed]
  Promise.all([
    getTouces("2017", "11"), 
    reduceAmounts(["ticket_category_adjust_payment_amount_and_or_date", "ticket_category_sign_up_assistance", "ticket_category_setup_unique_payment_plan"], ["open", "pending"]),
    reduceAmounts(["ticket_category_no_response_unable_to_collect_payment"], ["solved", "closed"]),
    reduceAmounts(["ticket_category_payment_failed_new_card"], ["open", "pending"])
  ]).then(values => { 
    console.log(values); // [3, 1337, "foo"] 
  });
}

function getTouces(year, month) {
  return new Promise((resolve, reject) => {
    try {
      let startDate = new Date(`${year}-${month}-01T00:00:00.0Z`);
      let endDate = new Date(`${year}-${month}-01T00:00:00.0Z`);
      endDate.setMonth(startDate.getMonth() + 1);
      endDate.setDate(0);
      dbService.connect((err, db) => {
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
              "events.updater_id": { $ne: -1 },
              "organization_id": { $ne: null }
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
            return reject(err)
          }
          resolve(docs)
        });

      });
    } catch (error) {
      log.error(error)
      reject(error)
    }
  })

}

function reduceAmounts(fields, status) {
  return new Promise((resolve, reject) => {
    try {
      dbService.connect((err, db) => {
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
            return reject(err)
          }
          let res = docs.map(elem => {
            var sum = elem.values.reduce( (prevVal, val) => {
              return prevVal + new Number(val);
            }, 0);
            return {
              _id: elem._id,
              amount: sum
            }
          })
          resolve(res)
        });

      });
    } catch (error) {
      log.error(error)
      reject(error)
    }
  })
}



module.exports = {
  getSummary: getSummary
};