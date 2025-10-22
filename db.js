// utf8mb4_unicode_520_ci

const Sequelize = require('sequelize')
const logger = require('./logger')

require('dotenv').config()

let sequelize = null

if (process.env.TESTING) {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: logger.logdb1, // Only logs first parameter to avoid error
    define: {
      timestamps: false, // Having as true weirdly causes test errors in Seqelize 5.22+
      dateStrings: true
    }
  })
} else {
  const database = process.env.DATABASE
  const dbuser = process.env.DBUSER
  const dbpass = process.env.DBPASS

  const dbConfig = {
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
  }

  // Cloud Run: Connect via Unix socket if CLOUD_SQL_CONNECTION_NAME is set
  if (process.env.CLOUD_SQL_CONNECTION_NAME) {
    const socketPath = `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`
    dbConfig.dialectOptions = {
      socketPath: socketPath
    }
    logger.log(`Database: Connecting to Cloud SQL via Unix socket: ${socketPath}`)
  } else {
    // Local development or traditional server: Connect via host/port
    dbConfig.host = process.env.DB_HOST || process.env.DBHOST || 'localhost'
    if (process.env.DB_PORT) {
      dbConfig.port = process.env.DB_PORT
    }
    logger.log(`Database: Connecting to MySQL at ${dbConfig.host}:${dbConfig.port || 3306}`)
  }

  sequelize = new Sequelize(database, dbuser, dbpass, dbConfig)
}

module.exports = sequelize
