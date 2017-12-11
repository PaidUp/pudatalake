"use strict";

const express = require("express");
const controller = require("./report.controller");
const router = express.Router();


router.get("/summary", controller.organizationMonthlySummary);

module.exports = router;
