/* eslint-env jest */

const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('OWNER', () => {
  it('submit actions', async () => {
    let testSucceeded = false
    try {
      testhelper.initThisTest()

      const app = require('../app')

      const initresult = await app.checkDatabases(maketestsite)
      if (initresult !== 1) throw new Error('initresult:' + initresult)

      const config = {}
      let error = await runscript.run(app.models, 'addpubsimpleflow.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'addusers.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-add-proposal-author1.json', false, app)
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

      error = await runscript.run(app.models, 'api-add-paper-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-logout.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-owner-submit-actions.json', false, app)
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
