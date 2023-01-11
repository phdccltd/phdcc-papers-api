const fs = require('fs')

function initThisTest () {
  if (process.env.TESTFILESDIR) {
    fs.rmSync(process.env.TESTFILESDIR, { recursive: true, force: true })
    fs.mkdirSync(process.env.TESTFILESDIR, { recursive: true })
  }
  if (process.env.TESTTMPDIR) {
    fs.rmSync(process.env.TESTTMPDIR, { recursive: true, force: true })
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

function countSubmits (reqd) { // Check count of submits returned by getPubSubmits
  return function (res) {
    try {
      if (reqd === res.body.flows[0].submits.length) {
        return false
      } else {
        return 'countSubmits: wanted ' + reqd + ' got ' + res.body.flows[0].submits.length
      }
    } catch (e) {
      return 'countSubmits exception ' + e.message
    }
  }
}

module.exports = { initThisTest, accumulog, accumulogged, waitUntilInited, countSubmits }
