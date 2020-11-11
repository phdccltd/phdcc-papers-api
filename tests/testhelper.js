const fs = require('fs')

function initThisTest () {
  if (process.env.TESTFILESDIR) {
    fs.rmdirSync(process.env.TESTFILESDIR, { recursive: true })
    fs.mkdirSync(process.env.TESTFILESDIR, { recursive: true })
  }
  if (process.env.TESTTMPDIR) {
    fs.rmdirSync(process.env.TESTTMPDIR, { recursive: true })
    fs.mkdirSync(process.env.TESTTMPDIR, { recursive: true })
  }
}

const output = []
function accumulog (...err) {
  let line = ''
  for (const e of err) {
    if (typeof e === 'object') {
      line += JSON.stringify(e)
    } else {
      line += e + ' '
    }
  }
  output.push(line)
}

function accumulogged () {
  return output.join('\n')
}

function waitUntilInited (app) {
  return new Promise(resolve => {
    function wait () {
      const initresult = app.get('initresult')
      if (initresult !== 0) resolve(initresult)
      else setTimeout(wait, 100)
    }
    setTimeout(wait, 100)
  })
}

module.exports = { initThisTest, accumulog, accumulogged, waitUntilInited }
