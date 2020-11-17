// utf8mb4_unicode_520_ci

const Sequelize = require('sequelize')
const logger = require('./logger')

require('dotenv').config()

let sequelize = null

if (process.env.TESTING) {
  sequelize = new Sequelize('sqlite::memory:', {
    logging: logger.logdb1, // Only logs first parameter to avoid error
    define: {
      timestamps: true, // true by default so as to add the timestamp attributes (updatedAt, createdAt)
      dateStrings: true
    }
  })
} else {
  const database = process.env.DATABASE
  const dbuser = process.env.DBUSER
  const dbpass = process.env.DBPASS

  sequelize = new Sequelize(database, dbuser, dbpass, {
    host: 'localhost',
    dialect: 'mysql',
    operatorsAliases: '0',

    // logging: logger.log,  // This causes sequelize error for related objects: Converting circular structure to JSON
    logging: logger.logdb1, // Only logs first parameter to avoid above error

    define: {
      timestamps: true, // true by default so as to add the timestamp attributes (updatedAt, createdAt)
      dateStrings: true
    },

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  })
}

module.exports = {
  sequelize
}
