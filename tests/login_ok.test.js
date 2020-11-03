/* eslint-env jest */
// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const request = require('supertest')
const testhelper = require('./testhelper')
const testsetup = require('./testsetup')
const addsimpleflow = require('../scripts/addsimpleflow')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('LOGIN', () => {
  it('Check correct login succeeds', async () => {
    const app = require('../app')

    const initresult = await app.checkDatabases(testsetup)
    console.log('initresult', initresult)

    if (initresult !== 1) {
      expect(initresult).toBe(1)
    } else {
      const simple = {}
      const error = await addsimpleflow.runscript(app.models, 'addsimpleflow.json', simple)
      if (error) {
        console.log(error)
        expect(error).toBe(false)
      } else {
        const res = await request(app)
          .post('/user/login')
          .send({
            username: 'jo',
            password: 'asecret',
            'g-recaptcha-response': process.env.RECAPTCHA_BYPASS
          })
        console.log(res.body) // {"ret":0,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC..."}

        expect(res.statusCode).toEqual(200)
        const rv = res.body.ret === 0 && typeof res.body.token === 'string'
        expect(rv).toBe(true)
      }
    }
    spyclog.mockRestore()
    spycerror.mockRestore()
    console.log('All console output\n', testhelper.accumulogged())
  })
})
