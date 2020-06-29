const output = []
function accumulog(...err) {
  let line = ''
  for (e of err) {
    if (typeof e === 'object') {
      line += JSON.stringify(e)
    } else {
      line += e + ' '
    }
  }
  output.push(line)
}

function accumulogged() {
  return output.join("\n")
}

function waitUntilInited(app) {
  return new Promise(resolve => {
    function wait() {
      const initresult = app.get('initresult')
      if (initresult !== 0) resolve(initresult)
      else setTimeout(wait, 100)
    }
    setTimeout(wait, 100)
  })
}


module.exports = { accumulog, accumulogged, waitUntilInited }
