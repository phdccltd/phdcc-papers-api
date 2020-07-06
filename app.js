const process = require('process')
const express = require('express')
const cors = require('cors')  // https://github.com/expressjs/cors
const bodyParser = require('body-parser')
const createError = require('http-errors')
const path = require('path')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const saltRounds = 10

const db = require('./db')
const models = require('./models')
const logger = require('./logger')
const utils = require('./utils')

var now = new Date();
global.starttime = now.toISOString()

logger.log('PAPERS STARTING: ', global.starttime, process.pid, 'LOGMODE', process.env.LOGMODE)

// Create express instance
const app = express()
app.set('sites', [])

app.options('*', cors()) // include before other routes
app.use(cors())

app.set('init', false)
app.set('initresult', 0)
async function checkDatabases() {
  try {
    await db.sequelize.authenticate()
    console.log('Connection has been established successfully.')

    // TODO??: Replace with migrations https://sequelize.org/master/manual/migrations.html
    await db.sequelize.sync({ alter: true });
    console.log("All models were synchronized successfully")
    await models.logs.create({ msg: 'Started' })
    console.log("Logged start")

    logger.setModels(models) // Let logger log to db logs, if enabled

    if (process.env.TESTING) {
      const sites = await models.sites.findAll()
      console.log('sites', sites.length)
      if (sites.length === 0) {
        const settings = {}
        let params = {
          url: '',
          name: 'Test site',
          settings: JSON.stringify(settings)
        }
        await models.sites.create(params)
        console.log("mock site created")
      }

      const users = await models.users.findAll()
      if (users.length === 0) {
        const params = {
          name: 'Jo',
          username: 'jo',
          password: await bcrypt.hash('asecret', saltRounds),
          super: true
        }
        const user = await models.users.create(params);
        if (!user) return routes.giveup(req, res, 'user not created')
        console.log("User created", params.name)
      }
    }

    // Make clean site info available to router
    const sites = []
    for (const sitedb of await models.sites.findAll()) {
      //console.log("sitedb", sitedb)
      try {
        const settings = JSON.parse(sitedb.settings)
        const site = { id: sitedb.id, url: sitedb.url, name: sitedb.name, settings: settings }
        sites.push(site)
      } catch (e) {
        console.error('SYNTAX ERROR IN settings for site', sitedb.id, sitedb.settings)
        if (!process.env.TESTING) {
          process.exit(1)
        }
      }
    }
    if (sites.length == 0) {
      console.error('NO SITES IN DATABASE SO EXITING')
      if (!process.env.TESTING) {
        process.exit(2)
      }
    }
    app.set('sites', sites)
    //console.log("app.sites", app.get('sites'))

    //"transport-from": "root@phdcc.co.uk", "admin-email": "cc+papersdev@phdcc.com"
    // Use first site to set mail transport
    const site = sites[0]
    const settings = sites[0].settings
    if (site.settings['transport-sendmail'] && site.settings['transport-newline'] && site.settings['transport-path'] && site.settings['email-from']) {
      try {
        const transport = nodemailer.createTransport({
          sendmail: site.settings['transport-sendmail'],
          newline: site.settings['transport-newline'],
          path: site.settings['transport-path']
        })
        app.set('transport', transport)
      } catch (e) {
        logger.log('Cannot create mail transport')
      }
    } else {
      logger.log('Mail transport parameters not specified')
    }
    const transport = app.get('transport')
    if (transport && site.settings['admin-email']) {
      utils.setMailTransport(transport, site.settings['email-from'], site.settings['admin-email'], site.name)
      utils.async_mail( false, site.name + " API RESTARTED", 'Server time: ' + global.starttime)
    }
    app.set('initresult', 1)
  } catch (error) {
    console.error('Database init error:', error)
    app.set('initresult', 2)
    if (!process.env.TESTING) {
      process.exit(3)
    }
  }
}
checkDatabases()

app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.json())

app.use(function (req, res, next) {
  const userip = req.headers['x-forwarded-for'] // x-forwarded-server
  req.userip = userip
  console.log('=== ', req.url)
  logger.log(userip, "+++Route:", process.env.BASEURL, req.url)
  //console.log(req.headers)
  next()
})

app.use(express.static(path.join(__dirname, 'public')));

// Require API routes
const apiRouter = require('./routes')
app.use(apiRouter.router)

//app.use('/', indexRouter)

// catch everything else
app.use(function (req, res, next) {
  logger.error("Unrouted request:", req.url)
  next(createError(404, 'Unrecognised request'))
})

// Handle all errors ie from above or exceptions
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  console.log('ERROR', err.message)
  //console.log(req.app.get('env'));
  //console.log(err);
  //res.locals.message = err.message;
  //res.locals.error = {};

  // render the error page
  res.status(err.status || 500).send(err.message)
})

module.exports = app
