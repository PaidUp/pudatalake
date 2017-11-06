"use strict";

const csv = require("fast-csv");

function readFile(path) {
  //var collection = global.db.collection("charges");
  var bulk = global.db.collection("charges").initializeUnorderedBulkOp();
  csv.fromPath(path, { headers: true })
    .on("data", function (row) {
      bulk.find({ id: row.id }).upsert().replaceOne(
        row
      );
    })
    .on("end", function () {
      bulk.execute(function (err, data) {
        console.log("@@@", new Date());
        console.log("@@@ERR", err);
        console.log("@@@Data", data.toJSON());
      });
    });
}

module.exports = {
  readFile: readFile
};