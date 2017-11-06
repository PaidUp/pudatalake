"use strict";

const express = require("express");
const router = express.Router();

router.use("/webhook", require("./webhook"));
module.exports = router;
