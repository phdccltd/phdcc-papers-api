// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const _ = require('lodash/core')
const request = require('supertest')
const testhelper = require('./testhelper')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

const app = require('../app')

describe('LOGIN', () => {
  it('Check incorrect login fails', async () => {
    const initresult = await testhelper.waitUntilInited(app)
    console.log('initresult', initresult)
    if (initresult !== 1) {
      expect(initresult).toBe(1)
    } else {
      const res = await request(app)
        .post('/user/login')
        .send({
          username: 'jo',
          password: 'wrongsecret',
        })
      console.log(res.body)

      spyclog.mockRestore()
      spycerror.mockRestore()
      console.log('All console output\n', testhelper.accumulogged())

      expect(res.statusCode).toEqual(200)
      const rv = _.isEqual(res.body, { ret: 1, status: 'Incorrect password' })
      expect(rv).toBe(true)
    }
  })
})
