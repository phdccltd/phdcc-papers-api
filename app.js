const process = require('process')
const express = require('express')
const cors = require('cors') // https://github.com/expressjs/cors
const bodyParser = require('body-parser')
const createError = require('http-errors')
const path = require('path')
const fs = require('fs')
const nodemailer = require('nodemailer')

const sequelize = require('./db')
const models = require('./models')
const logger = require('./logger')
const utils = require('./utils')
const backgroundRunner = require('./task')

let now = new Date()
global.starttime = now.toISOString()

logger.log('PAPERS STARTING: ', global.starttime, process.pid, 'LOGMODE', process.env.LOGMODE)

// Create express instance
const app = express()
app.disable("x-powered-by");
app.set('sites', [])

app.options('*', cors()) // include before other routes
app.use(cors())

app.set('init', false)
app.checkDatabases = async function (setupdb) {
  try {
    await sequelize.authenticate()
    console.log('Connection has been established successfully.')

    // TODO??: Replace with migrations https://sequelize.org/master/manual/migrations.html
    await sequelize.sync({ alter: true })
    console.log('All models were synchronized successfully')
    await models.logs.create({ msg: 'Started' })
    console.log('Logged start')

    // Get rid of any excess INDEXES
    try {
      await sequelize.query('ALTER TABLE `users` DROP INDEX `username_2`;')
      // const [results, metadata] =
      // console.log('DROP users index 2 ', results, metadata)
    } catch (e) {
      // Ignore any errors
    }

    logger.setModels(models) // Let logger log to db logs, if enabled

    if (setupdb) {
      app.models = models
      await setupdb(models)
    }

    // Make clean site info available to router
    const sites = []
    for (const sitedb of await models.sites.findAll()) {
      try {
        const _privatesettings = JSON.parse(sitedb.privatesettings)
        const _publicsettings = JSON.parse(sitedb.publicsettings)
        const _site = { id: sitedb.id, url: sitedb.url, name: sitedb.name, privatesettings: _privatesettings || {}, publicsettings: _publicsettings || {} }
        sites.push(_site)
      } catch (e) {
        console.error('SYNTAX ERROR IN settings for site', sitedb.id, sitedb.privatesettings, sitedb.publicsettings)
        if (!process.env.TESTING) {
          process.exit(1)
        }
      }
    }
    if (sites.length === 0) {
      console.error('NO SITES IN DATABASE SO EXITING')
      if (!process.env.TESTING) {
        process.exit(2)
      }
    }
    app.set('sites', sites)

    // Use first site to set mail transport
    const site = sites[0]
    const privatesettings = site.privatesettings
    const stopmail = ('stopmailfile' in privatesettings) && fs.existsSync(privatesettings.stopmailfile)
    if (stopmail) {
      logger.log('Stop mail file exists: ' + privatesettings.stopmailfile)
    } else if ('transport-sendmail' in privatesettings && 'transport-newline' in privatesettings && 'transport-path' in privatesettings && 'email-from' in privatesettings) {
      try {
        if (privatesettings['transport-sendmail']) {
          const _transport = nodemailer.createTransport({
            sendmail: privatesettings['transport-sendmail'],
            newline: privatesettings['transport-newline'],
            path: privatesettings['transport-path']
          })
          app.set('transport', _transport)
        } else { // SMTP
          const transportOptions = {
            host: privatesettings['transport-host']
          }
          if (privatesettings['transport-port']) transportOptions.port = privatesettings['transport-port']
          if (privatesettings['transport-pool']) transportOptions.pool = privatesettings['transport-pool']
          if (privatesettings['transport-secure']) {
            transportOptions.secure = privatesettings['transport-secure']
            transportOptions.auth = {
              user: privatesettings['transport-auth-user'],
              pass: privatesettings['transport-auth-pass']
            }
          }
          const _transport = nodemailer.createTransport(transportOptions)
          if (_transport) {
            const rv = await transport.verify()
            console.log('transport verify', rv)
            app.set('transport', _transport)
          }
        }
      } catch (e) {
        logger.log('Cannot create mail transport', e.message)
      }
    } else {
      logger.log('Mail transport parameters not specified')
    }
    const transport = app.get('transport')
    if (transport && privatesettings['admin-email']) {
      utils.setMailTransport(transport, privatesettings['email-from'], privatesettings['admin-email'], site.name)
      utils.asyncMail(false, site.name + ' - API RESTARTED ' + process.env.version, 'Server time: ' + global.starttime)
    }
    return 1
  } catch (error) {
    console.error('Database init error:', error)
    if (!process.env.TESTING) {
      process.exit(3)
    }
    return 2
  }
}
if (!process.env.TESTING) {
  app.checkDatabases()
}

app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.json())

app.use(function (req, res, next) {
  const userip = req.headers['x-forwarded-for'] // x-forwarded-server
  req.userip = userip
  // logger.log4req(req, '+++Route:', process.env.BASEURL, req.url)
  next()
})

app.use(express.static(path.join(__dirname, 'public')))

// Require API routes
const apiRouter = require('./routes')
app.use(apiRouter.router)

// app.use('/', indexRouter)

// catch everything else
app.use(function (req, res, next) {
  console.log('UNROUTED', req.url, req.method, req.headers)
  logger.error4req('Unrouted request:', req.url)
  next(createError(404, 'Unrecognised request'))
})

// Handle all errors ie from above or exceptions
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  console.log('ERROR', err.message)

  // render the error page
  res.status(err.status || 500).send(err.message)
})

now = new Date()
global.starttime = now.toISOString()
console.log('STARTED: ', global.starttime, process.pid)
let startupSeconds = parseInt(process.env.ST) || 15
if (startupSeconds < 1) startupSeconds = 1
console.log('startupSeconds:' + startupSeconds)
let intervalMinutes = parseInt(process.env.IM) || 17
if (intervalMinutes < 1) intervalMinutes = 1
console.log('intervalMinutes:' + intervalMinutes)
const intervalSeconds = 60 * intervalMinutes
if (!process.env.TESTING) {
  setTimeout(backgroundRunner, startupSeconds * 1000, app)
  setInterval(backgroundRunner, intervalSeconds * 1000, app)
}

logger.log('papers API app started: process ', process.pid)

module.exports = app
