/* eslint-env jest */

const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('COMPLETE', () => {
  it('Two papers', async () => {
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

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-proposal-author.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author3.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-proposal-author.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-proposal-accepted.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-proposal2-accepted.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-reviewers.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-reviewers2.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-paper-author.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author2.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-paper-bad2.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-with-reviewers.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-with-reviewers2.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author2.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-entry-paper.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-review-paper.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author3.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-entry-paper-bad1.json', false, app) // WRONG
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-paper-accepted.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-paper2-accepted.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app)
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
