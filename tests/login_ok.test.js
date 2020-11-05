/* eslint-env jest */
// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const request = require('supertest')
const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('LOGIN', () => {
  it('Check correct login succeeds', async () => {
    try {
      const app = require('../app')

      const initresult = await app.checkDatabases(maketestsite)
      console.log('initresult', initresult)

      if (initresult !== 1) { expect(initresult).toBe(1); throw new Exception('initresult') }
      const simple = {}
      const error = await runscript.run(app.models, 'addsimpleflow.json', simple)
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
    } catch (e) {
      console.log(e.message)
      expect(false).toBe(true)
    }
    spyclog.mockRestore()
    spycerror.mockRestore()
    console.log('All console output\n', testhelper.accumulogged())
  })
})
