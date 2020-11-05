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

describe('USER', () => {
  it('Check login and then get user', async () => {
    try {
      const app = require('../app')

      const initresult = await app.checkDatabases(maketestsite)
      if (initresult !== 1) throw new Error('initresult:' + initresult)

      const simple = {}
      let error = await runscript.run(app.models, 'addsimpleflow.json', simple)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'addusers.json', simple)
      if (error) throw new Error(error)

      const res1 = await request(app)
        .post('/user/login')
        .send({
          username: 'jo',
          password: 'asecret',
          'g-recaptcha-response': process.env.RECAPTCHA_BYPASS
        })
      console.log(res1.body) // {"ret":0,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC..."}
      const rv1 = res1.body.ret === 0 && typeof res1.body.token === 'string'
      const token = res1.body.token

      const res2 = await request(app)
        .get('/user')
        .set('authorization', 'bearer ' + token)
      console.log(res2.body) //
      const rv2 = _.isEqual(res2.body, { ret: 0, status: 'OK', user: { id: 1, name: 'Jo', username: 'jo', super: true, publicsettings: {} } })

      expect(res1.statusCode).toEqual(200)
      expect(rv1).toBe(true)
      expect(res2.statusCode).toEqual(200)
      expect(rv2).toBe(true)
    } catch (e) {
      console.log(e.message)
      expect(e.message).toBe(false)
    }
    spyclog.mockRestore()
    spycerror.mockRestore()
    console.log('All console output\n', testhelper.accumulogged())
  })
})
