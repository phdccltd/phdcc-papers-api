/* eslint-env jest */

process.env.LOGMODE = 'console'
const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')
const logger = require('../logger')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('SITE', () => {
  it('tests', async () => {
    let testSucceeded = false
    try {
      testhelper.initThisTest()

      const app = require('../app')

      const initresult = await app.checkDatabases(maketestsite)
      if (initresult !== 1) throw new Error('initresult:' + initresult)

      const config = {}
      let error = await runscript.run(app.models, 'addpubsimpleflow.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/addusers.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/addsitepages.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-site-test.json', false, app)
      if (error) throw new Error(error)

      // process.env.TESTING = false
      // error = await runscript.run(app.models, 'tests/api-site-fail-test.json', false, app)
      // if (error) throw new Error(error)

      logger.warn4req()
      await logger.error4req()
      logger.error()
      logger.logfull('duff')
      logger.logfull()
      logger.logfull('info', false, 'Mentioning logs')
      process.env.LOGSQL = 'true'
      logger.logdb1('SELECT * FROM tests')

      testSucceeded = true
    } catch (e) {
      console.log('TEST EXCEPTION', e.message)
      testSucceeded = false
    }
    spyclog.mockRestore()
    spycerror.mockRestore()
    console.log('All console output\n', testhelper.accumulogged())
    expect(testSucceeded).toBe(true)
  })
})
