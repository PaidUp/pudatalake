"use strict";

const express = require("express");
const router = express.Router();

router.use("/webhook", require("./webhook"));
router.use("/report", require("./report"));
module.exports = router;
