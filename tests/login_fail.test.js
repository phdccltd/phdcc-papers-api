/* eslint-env jest */
// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const _ = require('lodash')
const request = require('supertest')
const testhelper = require('./testhelper')
const testsetup = require('./testsetup')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('LOGIN', () => {
  it('Check incorrect login fails', async () => {
    const app = require('../app')

    const initresult = await app.checkDatabases(testsetup)
    console.log('initresult', initresult)

    if (initresult !== 1) {
      expect(initresult).toBe(1)
    } else {
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
    }
    spyclog.mockRestore()
    spycerror.mockRestore()
    console.log('All console output\n', testhelper.accumulogged())
  })
})
