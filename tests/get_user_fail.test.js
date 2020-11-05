/* eslint-env jest */
// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const _ = require('lodash')
const request = require('supertest')
const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

describe('USER', () => {
  it('Fail when not logged in', async () => {
    const app = require('../app')

    const initresult = await app.checkDatabases(maketestsite)
    console.log('initresult', initresult)

    if (initresult !== 1) {
      expect(initresult).toBe(1)
    } else {
      const res = await request(app)
        .get('/user')
      console.log(res.body) //

      expect(res.statusCode).toEqual(200)
      const rv = _.isEqual(res.body, { ret: 1, status: 'Not logged in' })
      expect(rv).toBe(true)
    }
    spyclog.mockRestore()
    spycerror.mockRestore()
    console.log('All console output\n', testhelper.accumulogged())
  })
})
