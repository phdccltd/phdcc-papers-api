/* eslint-env jest */
/* Acceptings determine which stages are open for submission (and at what status)
 * - Check acceptings can be added, edited and deleted by owner
 * - Check stage (without status) can/cannot be submitted if open/closed
 * - Check stage cannot be submmitted if at wrong status
 * - Check stage (with status) can/cannot be submitted if open/closed
 */

const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('ACCEPTINGS', () => {
  it('check all permutations', async () => {
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

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-accepting-test1.json', false, app) // Proposal closed, Paper open
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-proposal-closed.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-accepting-test2.json', false, app) // Proposal open, Paper closed
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-proposal-author.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-paper-not-at-stage.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-proposal-accepted.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-paper-closed.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-accepting-test3.json', false, app) // Paper open again
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-paper-author.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-accepting-bad1.json', false, app)
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
