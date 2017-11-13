"use strict";

const express = require("express");
const controller = require("./datalake.controller");
const router = express.Router();
const bodyParser = require("body-parser");
const rawParser = bodyParser.raw({type: "*/*"});

router.post("/stripe", rawParser, controller.saveStripeRequest);
router.post("/stripe/:type", rawParser, controller.saveStripeRequest);

module.exports = router;
