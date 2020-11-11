/* eslint-env jest */

const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('SUBMIT', () => {
  it('Add new proposal bad5', async () => {
    let testSucceeded = false
    try {
      const app = require('../app')

      const initresult = await app.checkDatabases(maketestsite)
      if (initresult !== 1) throw new Error('initresult:' + initresult)

      const config = {}
      let error = await runscript.run(app.models, 'addsimpleflow.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'addusers.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-add-proposal-bad5.json', false, app)
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
