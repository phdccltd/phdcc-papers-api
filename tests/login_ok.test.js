// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest

const _ = require('lodash/core')

const testhelper = require('./testhelper')

/*test('PAPERS API #1', async () => {

  const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
  const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)
  const argv = ['node', '.', 'tests/data/gb1-date-test-config.json']
  let rv = await mkdistmaps.run(argv)
  spyclog.mockRestore()
  spycerror.mockRestore()
  console.log('All console output\n', testhelper.accumulogged())

  if (rv === 1) {
    rv = await testhelper.checkFilesEqual('tests/expected/GB1-Species.png', 'tests/output/GB1-Species.png')
  }
  const rv = 1
  expect(rv).toBe(1)
})*/

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

const request = require('supertest')
console.log("START")
const app = require('../app')
console.log("STARTED")

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
        })
      console.log(res.body) // {"ret":0,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC..."}

      spyclog.mockRestore()
      spycerror.mockRestore()
      console.log('All console output\n', testhelper.accumulogged())

      expect(res.statusCode).toEqual(200)
      const rv = res.body.ret === 0 && typeof res.body.token==='string'
      console.log('rv', rv)
      expect(rv).toBe(true)
    }
  })
})
