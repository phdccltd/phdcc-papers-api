/* eslint-env jest */
// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const _ = require('lodash')
const request = require('supertest')
const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

describe('USER', () => {
  it('Fail when not logged in', async () => {
    let testSucceeded = false
    try {
      const app = require('../app')

      const initresult = await app.checkDatabases(maketestsite)
      if (initresult !== 1) throw new Error('initresult:' + initresult)

      const simple = {}
      let error = await runscript.run(app.models, 'addsimpleflow.json', simple)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'addusers.json', simple)
      if (error) throw new Error(error)

      const res = await request(app)
        .get('/user')
      console.log(res.body) //

      if (res.statusCode !== 200) throw new Error('Bad HTTP status ' + res.statusCode)
      testSucceeded = _.isEqual(res.body, { ret: 1, status: 'Not logged in' })
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
