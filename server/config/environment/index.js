"use strict";

const path = require("path");
const _ = require("lodash");


// All configurations will extend these options
// ============================================
let all = {
  env: process.env.NODE_ENV,

  // Root path of server
  root: path.normalize(__dirname + "/../../.."),

  // Server port
  port: process.env.PORT || 9004,

  // Secret for session, you will want to change this and make it an environment variable
  secrets: {
    session: "puproduct-secret"
  },
  stripe: {
    account: "paidup",
    key: "sk_test_9AioI4XzoZbMuInmqEAZukPr",
    webhook: {
      datalake: {
        account: "whsec_Y3ghPzdEZCiWldbpVhPtRsT3ouxPCWnt",
        connect: "whsec_vmQ3i1kSr91QRl9jey8V0CLKqLafKJnB"
      }
    }
  },
  nodePass: {
    me: {
      "token": "puproduct-secret"
    }
  },
  // MongoDB connection options
  mongo: {
    uri: "mongodb://pudevelop:xEbiMFBtX48ObFgC@pu-dev-shard-00-00-4nodg.mongodb.net:27017,pu-dev-shard-00-01-4nodg.mongodb.net:27017,pu-dev-shard-00-02-4nodg.mongodb.net:27017/develop?ssl=true&replicaSet=pu-dev-shard-0&authSource=admin",
    options: {
      db: {
        safe: true
      },
      prefix: ""
    }
  },

  logger: {
    level: {
      info: "info",
      warn: "warn",
      error: "error"
    },
    loggly: {
      token: "0b55b141-1a00-40d5-951e-ae8e616b0b94",
      subdomain: "devgetpaidup",
      tags: ["paidup", "datalake"],
      json: true
    }
  },
  encryptKey: "PZ3oXv2v6Pq5HAPFI9NFbQ==",
  bugsnag: "7389712c2988e8661205b7fb78ca99ee",
  zendesk: {
    url: "https://getpaidup1478060212.zendesk.com",
    username: "ricardo@getpaidup.com",
    password: "acDb/aFSXiwkr~Zj4IxdFzja",
    export: {
      tickets: {
        minute: 0,
        count: 1000
      },
      ticket_events: {
        minute: 10,
        count: 1000
      },
      ticket_metric_events: {
        minute: 30,
        count: 10000
      }
    }
  }
};

// Export the config object based on the NODE_ENV
// ==============================================
module.exports = all;
module.exports = _.merge(
  all,
  require("./" + process.env.NODE_ENV + ".js") || {});
