'use strict'

// Test specific configuration
// ===========================
module.exports = {
  // MongoDB connection options
  mongo: {
    uri: 'mongodb://localhost/convenience-test',
    options: {
      prefix: 'puproduct_'
    }
  },
  commerce: {
    magento: {
      host: 'develop.getpaidup.com',
      port: 8888,
      path: '/api/xmlrpc/',
      login: 'magento',
      pass: 'Sv38SJVR'
    },
    paymentPlan: {
      intervalElapsed: 5,
      intervalType: 'minutes'
    }
  },
  nodePass: {
    me: {
      me: 'tdschedule-secret'
    }
  }

}
