//const fc = require('filecompare');

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

async function checkFilesEqual(path1, path2) {
  const areFilesEqual = new Promise((resolve, reject) => {
    fc(path1, path2, isEqual => {
        resolve(isEqual)
      })
  })
  if (!await areFilesEqual) {
    console.log('FILES NOT EQUAL', path1, path2)
    return -1
  }
  return 1
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


module.exports = { checkFilesEqual, accumulog, accumulogged, waitUntilInited }
