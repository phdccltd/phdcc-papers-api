// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const _ = require('lodash')
const request = require('supertest')
const testhelper = require('./testhelper')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'
const app = require('../app')

describe('LOGIN', () => {
  it('Check correct login succeeds', async () => {
    const initresult = await testhelper.waitUntilInited(app)
    console.log('initresult', initresult)
    
    if (initresult !== 1) {
      expect(initresult).toBe(1)
    } else {
      const res = await request(app)
        .post('/user/login')
        .send({
          username: 'jo',
          password: 'asecret',
          'g-recaptcha-response': process.env.RECAPTCHA_BYPASS
        })
      console.log(res.body) // {"ret":0,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC..."}

      spyclog.mockRestore()
      spycerror.mockRestore()
      console.log('All console output\n', testhelper.accumulogged())

      expect(res.statusCode).toEqual(200)
      const rv = res.body.ret === 0 && typeof res.body.token==='string'
      expect(rv).toBe(true)
    }
  })
})
