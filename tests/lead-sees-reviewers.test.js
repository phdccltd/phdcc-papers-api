/* eslint-env jest */

const testhelper = require('./testhelper')
const maketestsite = require('./maketestsite')
const runscript = require('./runscript')

const spyclog = jest.spyOn(console, 'log').mockImplementation(testhelper.accumulog)
const spycerror = jest.spyOn(console, 'error').mockImplementation(testhelper.accumulog)

process.env.RECAPTCHA_BYPASS = 'BypassingRecaptchaTest'

describe('LEAD REVIEWER VISIBILITY', () => {
  it('Lead reviewer sees all reviewers on a submission', async () => {
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

      // Author1 logs in and submits proposal
      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-proposal-author.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-logout.json', false, app)
      if (error) throw new Error(error)

      // Owner accepts proposal
      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-proposal-accepted.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-logout.json', false, app)
      if (error) throw new Error(error)

      // Author1 submits paper
      error = await runscript.run(app.models, 'tests/api-login-author1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-add-paper-author.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-logout.json', false, app)
      if (error) throw new Error(error)

      // Owner sets status to "Paper with reviewers" and adds reviewers
      error = await runscript.run(app.models, 'tests/api-login-owner1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-status-with-reviewers.json', false, app)
      if (error) throw new Error(error)

      // Add author2 (user 4) as non-lead reviewer, reviewer1 (user 6) as lead
      error = await runscript.run(app.models, 'tests/api-add-reviewers.json', false, app)
      if (error) throw new Error(error)

      // Move status to "Paper accepted" so we're NOT at the grading status
      error = await runscript.run(app.models, 'tests/api-status-paper-accepted.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-logout.json', false, app)
      if (error) throw new Error(error)

      // Log in as lead reviewer (reviewer1) and check they see all reviewers
      error = await runscript.run(app.models, 'tests/api-login-reviewer1.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app, false, function (res) {
        try {
          const submits = res.body.flows[0].submits
          if (submits.length !== 1) return 'Lead: expected 1 submit, got ' + submits.length
          const reviewers = submits[0].reviewers
          if (reviewers.length !== 2) return 'Lead: expected 2 reviewers, got ' + reviewers.length
          const leadReviewer = reviewers.find(r => r.lead === true)
          if (!leadReviewer) return 'Lead: no lead reviewer found in list'
          const nonLeadReviewer = reviewers.find(r => r.lead === false)
          if (!nonLeadReviewer) return 'Lead: no non-lead reviewer found in list'
          if (!leadReviewer.username) return 'Lead: lead reviewer has empty username'
          if (!nonLeadReviewer.username) return 'Lead: non-lead reviewer has empty username'
          return false
        } catch (e) {
          return 'Lead reviewer check exception: ' + e.message
        }
      })
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-logout.json', false, app)
      if (error) throw new Error(error)

      // Log in as non-lead reviewer (author2) and check they do NOT see all reviewers
      error = await runscript.run(app.models, 'tests/api-login-author2.json', false, app)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/api-get-submits.json', false, app, false, function (res) {
        try {
          const submits = res.body.flows[0].submits
          if (submits.length !== 1) return 'NonLead: expected 1 submit, got ' + submits.length
          const reviewers = submits[0].reviewers
          if (reviewers.length !== 0) return 'NonLead: expected 0 reviewers, got ' + reviewers.length
          return false
        } catch (e) {
          return 'Non-lead reviewer check exception: ' + e.message
        }
      })
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
