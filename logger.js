// Copyright © 2020 PHD Computer Consultants Ltd

const fs = require('fs')
const path = require('path')
const rfs = require('rotating-file-stream')

const logToConsole = process.env.LOGMODE === 'console'

let models = false

const logDirectory = path.join(__dirname, 'log')
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory) // ensure log directory exists

// Create our own log
const logstream = rfs.createStream('papersapp.log', {
  interval: '1d', // rotate daily
  path: logDirectory
})

function log () {
  return logfull('info', false, ...arguments)
}
module.exports.log = log

// warn4req(req,messages)
function warn4req () {
  return logfull('warning', ...arguments)
}
module.exports.warn4req = warn4req

// log4req(req,messages)
function log4req () {
  return logfull('info', ...arguments)
}
module.exports.log4req = log4req

// logfull(level,req,messages)
function logfull () {
  let userip = null
  let userid = null
  let actid = null
  let level = null
  let originalUrl = null
  if (arguments.length >= 1) {
    level = arguments[0]
    if (level !== 'info' && level !== 'warning' && level !== 'error') level = null
  }
  if (arguments.length >= 2) {
    const req = arguments[1]
    if (req) {
      userip = req.headers['x-forwarded-for'] // x-forwarded-server
      if (req.dbuser) userid = req.dbuser.id
      if (req.dbuser && 'actas' in req.dbuser) actid = req.dbuser.actas
      originalUrl = req.originalUrl
    }
  }
  const now = (new Date()).toISOString()
  logstream.write(now)
  const argstring = []
  for (let i = 2; i < arguments.length; i++) {
    argstring.push(JSON.stringify(arguments[i]))
  }
  const allargstring = argstring.join(' ')
  logstream.write(allargstring)
  logstream.write('\n')

  if (logToConsole) console.log(now, allargstring)

  try {
    if (models) {
      if (allargstring.indexOf('`logs`') === -1) { // Don't log to db writing to the logs!
        models.logs.create({ // Transaction OK ie ignore if there's an error but carry on
          ip: userip,
          userid: userid,
          actid: actid,
          level: level,
          url: originalUrl,
          msg: allargstring
        })
      }
    }
  } catch (e) {
    console.log('logger.log error', e)
  }
  return allargstring
}
module.exports.logfull = logfull

function logdb1 () { // Only logs first parameter to avoid sequelize log error: Converting circular structure to JSON
  if (process.env.LOGSQL && process.env.LOGSQL.toLowerCase() === 'true') {
    if (arguments.length >= 1) {
      log(arguments[0])
    }
  }
}
module.exports.logdb1 = logdb1

// error(messages)
function error () {
  error4req(false, ...arguments)
}
module.exports.error = error

// error4req(req,messages)
async function error4req () {
  logfull('error', ...arguments)
  // const allargstring = logfull('error', ...arguments)
  // utils.asyncMail(false, utils.getSiteName() + ' error ' + arguments[1], allargstring)
}
module.exports.error4req = error4req

function setModels (m) {
  models = m
}
module.exports.setModels = setModels

log('LOGGER LOADED')
