// CALLED ONLY ONCE BEFORE ALL TESTS
const fs = require('fs')


function setupOnce () {
  console.log('JEST ONCE')
  process.env = {}

  process.env.JWT_SECRET = 'Testing-seret'
  process.env.TESTING = true
  process.env.TESTFILESDIR = __dirname + '/testfilesdir'
  process.env.TESTTMPDIR = __dirname + '/testtmpdir/'
  fs.mkdirSync(process.env.TESTFILESDIR, { recursive: true })
  fs.mkdirSync(process.env.TESTTMPDIR, { recursive: true })
}

module.exports = setupOnce
