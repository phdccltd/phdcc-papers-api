// Copyright © 2020 PHD Computer Consultants Ltd

const fs = require('fs')
const path = require('path')
const rfs = require('rotating-file-stream')
const utils = require('./utils')

const logToConsole = process.env.LOGMODE=='console'

let models = false

const logDirectory = path.join(__dirname, 'log')
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)  // ensure log directory exists

// Create our own log
const logstream = rfs.createStream('confapp.log', {
  interval: '1d', // rotate daily
  path: logDirectory
})

function log() {
  const now = (new Date()).toISOString()
  logstream.write(now)
  const argstring = []
  for (const i in arguments) {
    argstring.push(JSON.stringify(arguments[i]))
  }
  const allargstring = argstring.join(' ')
  logstream.write(allargstring)
  logstream.write('\n')

  if (logToConsole) console.log(now, allargstring)

  try {
    if (models) {
      if (allargstring.indexOf('`logs`') === -1) {  // Don't log to db writing to the logs!
        models.logs.create({ msg: allargstring })
      }
    }
  } catch (e) {
    console.log('logger.log error',e)
  }
  return argstring
}
module.exports.log = log

function logdb1() {   // Only logs first parameter to avoid sequelize log error: Converting circular structure to JSON
  if (process.env.LOGSQL && process.env.LOGSQL.toLowerCase()=='true') {
    if (arguments.length >= 1) {
      log(arguments[0])
    }
  }
}
module.exports.logdb1 = logdb1

function error() {
  const argstring = log(arguments)
  utils.async_mail(false, utils.getSiteName() + ' error ' + arguments[0], argstring)
}
module.exports.error = error

function setModels(m) {
  models = m
}
module.exports.setModels = setModels

log("STARTED")

