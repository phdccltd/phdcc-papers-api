/* eslint-env jest */
// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

describe('PUBS', () => {
  it('tests', async () => {
    let testSucceeded = false
    try {
      testhelper.initThisTest()

      const app = require('../app')

      const initresult = await app.checkDatabases(maketestsite)
      if (initresult !== 1) throw new Error('initresult:' + initresult)

      const simple = {}
      let error = await runscript.run(app.models, 'addpubsimpleflow.json', simple)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/addusers.json', simple)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/addpub2withuser.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-super.json', false, app)
      if (error) throw new Error(error)

      const resBody = {}
      error = await runscript.run(app.models, 'tests/api-super-pubs-actions.json', false, app, resBody)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-pubs-actions.json', false, app, resBody)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-pubs-actions.json', false, app, resBody)
      if (error) throw new Error(error)
      /*try {
        const currentstatus = resBody.body.flows[0].submits[0].statuses[0]
        if (currentstatus.flowstatusId !== 3) throw new Error('currentstatus.flowstatusId!==3')
        console.log('currentstatus.flowstatusId===3')
      } catch (e) {
        console.log(e.message)
      }*/

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
