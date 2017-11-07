"use strict";

module.exports = function (app) {
  // Insert routes below
  app.use("/api/v1", require("./api"));

  app.route("/*")
    .get(function (err, res) {
      res.status(404).end();
    });
};
