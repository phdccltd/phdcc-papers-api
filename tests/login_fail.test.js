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

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('LOGIN', () => {
  it('Check incorrect login fails', async () => {
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
        .post('/user/login')
        .send({
          username: 'jo',
          password: 'wrongsecret',
          'g-recaptcha-response': process.env.RECAPTCHA_BYPASS
        })
      console.log(res.body)

      expect(res.statusCode).toEqual(200)
      const rv = _.isEqual(res.body, { ret: 1, status: 'Incorrect password' })
      expect(rv).toBe(true)
    } catch (e) {
      console.log(e.message)
      expect(e.message).toBe(false)
    }
    spyclog.mockRestore()
    spycerror.mockRestore()
    console.log('All console output\n', testhelper.accumulogged())
  })
})
