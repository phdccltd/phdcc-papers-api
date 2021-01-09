/* eslint-env jest */

/*
 * author1 adds submit 1: proposal entry 1
 * author3 adds submit 2: proposal entry 2
 * owner1 sets status proposal-accepted for submits 1 and 2
 * owner1 adds reviewers to submit 1: Author2 and lead Reviewer1
 * owner1 adds reviewers to submit 2: Author2 and lead Reviewer1
 * author1 adds paper entry 3 to submit 1
 * Check author2 cannot add to submit 1
 * owner1 sets status with-reviewers for submit 1
 * owner1 sets status with-reviewers for submit 2 (even though no paper submitted)
 * Check owner1 can see two submits
 * Check author2 can see two submits
 * Check author2 can see submit 1 entry 3 ie paper and get paper's file
 * author2 reviews submit 1
 * Check author2 can still see two submits
 * Check author3 cannot access submit 1 entry 3 paper, nor paper's file
 * owner1 sets status paper-accepted for submit 1
 * owner1 sets status paper-accepted for submit 2 (even though no paper submitted)
 * Check owner1 can still see two submits
 * Check author1 sees only one submit
 */

const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('COMPLETE', () => {
  it('Two papers', async () => {
    let testSucceeded = false
    try {
      testhelper.initThisTest()

      const app = require('../app')

      const initresult = await app.checkDatabases(maketestsite)
      if (initresult !== 1) throw new Error('initresult:' + initresult)

      const config = {}
      let error = await runscript.run(app.models, 'addpubsimpleflow.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/addusers.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-proposal-author.json', false, app) // author1 adds submit 1: proposal entry 1
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author3.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-proposal-author.json', false, app) // author3 adds submit 2: proposal entry 2
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-proposal-accepted.json', false, app) // owner1 sets status proposal-accepted for submits 1 and 2
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-proposal2-accepted.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-reviewers.json', false, app) // owner1 adds reviewers to submit 1: Author2 and lead Reviewer1
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-reviewers2.json', false, app) // owner1 adds reviewers to submit 2: Author2 and lead Reviewer1
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-paper-author.json', false, app) // author1 adds paper entry 3 to submit 1
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author2.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-paper-bad2.json', false, app) // Check author2 cannot add to submit 1
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-with-reviewers.json', false, app) // owner1 sets status with-reviewers for submit 1
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-with-reviewers2.json', false, app) // owner1 sets status with-reviewers for submit 2 (even though no paper submitted)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app, false, testhelper.countSubmits(2)) // Check owner1 can see two submits
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author2.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app, false, testhelper.countSubmits(2)) // Check author2 can see two submits
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-entry-paper2.json', false, app) // Check author2 can see submit 1 entry 3 ie paper and get paper's file
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-review-paper.json', false, app) // author2 reviews submit 1
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app, false, testhelper.countSubmits(2)) // Check author2 can still see two submits
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author3.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-entry-paper-bad1.json', false, app) // Check author3 cannot access submit 1 entry 3 paper, nor paper's file
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-paper-accepted.json', false, app) // owner1 sets status paper-accepted for submit 1
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-paper2-accepted.json', false, app) // owner1 sets status paper-accepted for submit 2 (even though no paper submitted)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app, false, testhelper.countSubmits(2)) // Check owner1 can still see two submits
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app, false, testhelper.countSubmits(1)) // Check author1 sees only one submit
      if (error) throw new Error(error)

      testSucceeded = true
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
