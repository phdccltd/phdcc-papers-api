/* eslint-env jest */
// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('USER', () => {
  it('author not permitted', async () => {
    let testSucceeded = false
    try {
      testhelper.initThisTest()

      const app = require('../app')

      const initresult = await app.checkDatabases(maketestsite)
      if (initresult !== 1) throw new Error('initresult:' + initresult)

      const simple = {}
      let error = await runscript.run(app.models, 'addpubsimpleflow.json', simple)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'addusers.json', simple)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-add-proposal-author.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-logout.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-status-proposal-accepted.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-logout.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-add-paper-author.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-author-not-permitted.json', false, app)
      if (error) throw new Error(error)

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
