'use strict'

// Production specific configuration
// =================================
const mongoHost = process.env.TDUSER_MONGO_HOST || 'localhost'
module.exports = {
  // Server IP
  mongo: {
    uri: 'mongodb://' + mongoHost + '/convenience-dev',
    options: {
      prefix: 'puproduct_'
    }
  }
}
