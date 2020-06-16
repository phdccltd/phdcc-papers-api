
const express = require('express')
//const session = require('express-session')
//const MySQLStore = require('express-mysql-session')(session)
const bodyParser = require('body-parser')
const createError = require('http-errors')
const path = require('path')

// Create express instance
const app = express()

/*var options = {
  host: 'localhost',
  port: 3306,
  user: process.env.DATABASE,
  password: process.env.DBUSER,
  database: process.env.DBPASS
}
const sessionStore = new MySQLStore(options) // Does connection persist or need closing??

app.use(session({ // must be before routes are use-d
  key: 'confapp',
  secret: process.env.COOKIESECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false
}))*/

app.use(bodyParser.urlencoded({ extended: false }))

app.use(function (req, res, next) {
  console.log("===Route:", req.url)
  next()
})

app.use(express.static(path.join(__dirname, 'public')));

// Require API routes
const apiRouter = require('./routes/api')
app.use('/api', apiRouter)
//app.use('/', indexRouter)

// catch everything else
app.use(function (req, res, next) {
  //logger.log("404:", req.url)
  console.log("Unrouted request:", req.url)
  next(createError(404, 'Unrecognised request'))
})

// Handle all errors ie from above or exceptions
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  console.log("ERROR");
  console.log(req.app.get('env'));
  //console.log(err);
  //res.locals.message = err.message;
  //res.locals.error = {};

  // render the error page
  res.status(err.status || 500).send(err.message)
})

module.exports = app
