// Copyright © 2020 PHD Computer Consultants Ltd

const fs = require('fs')
const path = require('path')
const rfs = require('rotating-file-stream')

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
  const now = new Date()
  logstream.write(now.toISOString())
  const argstring = []
  for (const i in arguments) {
    argstring.push(JSON.stringify(arguments[i]))
  }
  const allargstring = argstring.join(' ')
  logstream.write(allargstring)
  logstream.write('\n')

  if (logToConsole) console.log(allargstring)

  try {
    if (models) {
      if (allargstring.indexOf('`logs`') === -1) {  // Don't log to db writing to the logs!
        models.logs.create({ msg: allargstring })
      }
    }
  } catch (e) {
    console.log('logger.log error',e)
  }
}

function logdb1() {   // Only logs first parameter to avoid sequelize log error: Converting circular structure to JSON
  if (process.env.LOGSQL && process.env.LOGSQL.toLowerCase()=='true') {
    if (arguments.length >= 1) {
      log(arguments[0])
    }
  }
}

function setModels(m) {
  models = m
}

log("STARTED")

module.exports = {
  setModels: setModels,
  log: log,
  logdb1: logdb1
}
