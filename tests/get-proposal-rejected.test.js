/* eslint-env jest */

const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('GET', () => {
  it('submits with rejected proposal', async () => {
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

      error = await runscript.run(app.models, 'api-status-proposal-rejected.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-logout.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'api-login-author1.json', false, app)
      if (error) throw new Error(error)

      const resBody = {}
      error = await runscript.run(app.models, 'api-get-proposal-rejected.json', false, app, resBody)
      if (error) throw new Error(error)
      try {
        const currentstatus = resBody.body.flows[0].submits[0].statuses[0]
        if (currentstatus.flowstatusId !== 3) throw new Error('currentstatus.flowstatusId!==3')
        console.log('currentstatus.flowstatusId===3')
      } catch (e) {
        console.log(e.message)
      }

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
