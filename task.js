const Sequelize = require('sequelize')
const Handlebars = require("handlebars")
const _ = require('lodash/core')
const models = require('./models')
const utils = require('./utils')
const logger = require('./logger')

let started = false

/* ************************ */

async function startup() {
  try {
    await utils.async_sleep(1000) // Let startup pushes get out
  }
  catch (e) {
  }
}

/* ************************ */

async function backgroundTask() {
  const now = new Date()
  const nowms = now.getTime()  // getTime is in UTC
  console.log('backgroundTask START UTC: ', now)
  try {
    // Find all rules that are reminders
    const dbflowmailrules = await models.flowmailrules.findAll({
      where: {
        [Sequelize.Op.or]: [
          { sendReviewReminderDays: { [Sequelize.Op.gt]: 0 } },
          { sendLeadReminderDays: { [Sequelize.Op.gt]: 0 } },
          { sendReviewChaseUpDays: { [Sequelize.Op.gt]: 0 } },
        ],
      }
    })
    for (const dbmailrule of dbflowmailrules) {
      //console.log('dbmailrule', dbmailrule.id, dbmailrule.name, dbmailrule.flowstatusId, dbmailrule.flowgradeId)

      if (dbmailrule.flowstatusId === null || dbmailrule.flowgradeId === null) {
        console.log('backgroundTask flowstatusId or flowgradeId null', dbmailrule.id)
        continue
      }

      // Find all submit statuses which have the right status
      const dbsubmitstatuses = await models.submitstatuses.findAll({ where: { flowstatusId: dbmailrule.flowstatusId } })
      for (const dbsubmitstatus of dbsubmitstatuses) {
        // Get the submit of this status
        const dbsubmit = await dbsubmitstatus.getSubmit()
        if (!dbsubmit) {
          console.log('backgroundTask submit not found for status', dbmailrule.id, dbsubmitstatus.id)
          continue
        }
        // Get the statuses of this submit
        const dbstatuses = await dbsubmit.getStatuses({ order: [['id', 'DESC']] })
        if (dbstatuses.length === 0) continue
        // If we're past this status, then don't process rule
        if (dbstatuses[0].id !== dbsubmitstatus.id) continue

        // See if enough time has elapsed to trigger rule
        const elapseddays = (now - dbsubmitstatus.dt) / 1000 / 60 / 60 / 24
        //console.log('Submit', dbsubmit.id, 'at this status', dbsubmitstatus.dt, elapseddays, dbmailrule.sendReviewReminderDays, dbmailrule.sendLeadReminderDays, dbmailrule.sendReviewChaseUpDays)
        const sendReminder = dbmailrule.sendReviewReminderDays ? elapseddays > dbmailrule.sendReviewReminderDays : false
        const sendLeadReminder = dbmailrule.sendLeadReminderDays ? elapseddays > dbmailrule.sendLeadReminderDays : false
        const sendChaseUp = dbmailrule.sendReviewChaseUpDays ? elapseddays > dbmailrule.sendReviewChaseUpDays : false
        if (!sendReminder && !sendLeadReminder && !sendChaseUp) continue
        //console.log('sendReminder || sendLeadReminder || sendChaseUp')

        const dbgradings = await dbsubmit.getGradings()
        const dbreviewers = await dbsubmit.getReviewers()
        let allReviewsDone = true
        for (const dbreviewer of dbreviewers) {
          //console.log('dbreviewer', dbreviewer.id, dbreviewer.userId, dbreviewer.lead)

          const dbsentreminders = await dbmailrule.getSentReminders({ where: { userId: dbreviewer.userId, submitId: dbsubmit.id } })
          if (dbsentreminders.length > 0) continue

          //console.log('+ Reminder may be needed')
          const graded = _.find(dbgradings, (grading) => { return grading.userId == dbreviewer.userId })
          if (!graded) {
            if (!dbreviewer.lead) allReviewsDone = false
            if (sendReminder && !dbreviewer.lead) {
              //console.log('  + Reviewer', dbreviewer.userId, 'NOT graded: SEND REMINDER to non-lead!!')
              sendMail(dbmailrule, dbsubmit, dbreviewer)
            }
            if (sendLeadReminder && dbreviewer.lead) {
              //console.log('  + Lead', dbreviewer.userId, 'NOT graded: SEND REMINDER to lead!!')
              sendMail(dbmailrule, dbsubmit, dbreviewer)
            }
          }
        }
        if (sendChaseUp && !allReviewsDone) {
          //console.log('=== Not all reviews done: SEND REMINDER to leads')
          for (const dbreviewer of dbreviewers) {
            if (dbreviewer.lead) {
              const dbsentreminders = await dbmailrule.getSentReminders({ where: { userId: dbreviewer.userId, submitId: dbsubmit.id } })
              if (dbsentreminders.length > 0) continue

              //console.log('    Lead', dbreviewer.userId)
              sendMail(dbmailrule, dbsubmit, dbreviewer)
            }
          }
        }
      }
    }
  }
  catch (e) {
    console.log(e.message)
    logger.log(__filename, 'backgroundTask', e.message)
  }

}

/* ************************ */

async function sendMail(dbmailrule, dbsubmit, dbreviewer) {

  const dbtemplate = await dbmailrule.getFlowmailtemplate()
  if (!dbtemplate) return logger.warn4req(false, 'Could not find flowmailtemplate for rule', dbmailrule.id)

  const dbuser = await dbreviewer.getUser()
  if (!dbuser) return logger.warn4req(false, 'Could not find user for reviewer')


  let subject = Handlebars.compile(dbtemplate.subject)
  let body = Handlebars.compile(dbtemplate.body)

  const bccOwners = []
  if (dbmailrule.bccToOwners) {
    const dbflow = await dbsubmit.getFlow()
    if (!dbflow) return logger.warn4req(false, 'Could not find flow so not sending mail')
    const dbpub = await dbflow.getPub()
    if (!dbpub) return logger.warn4req(false, 'Could not find pub so not sending mail')
    const dbownerroles = await dbpub.getPubroles({ where: { isowner: true } })
    for (const dbownerrole of dbownerroles) {
      const dbownerusers = await dbownerrole.getUsers()
      for (const dbowneruser of dbownerusers) {
        bccOwners.push(dbowneruser.email)
      }
    }
  }

  const dbauthor = await dbsubmit.getUser()
  const author = dbauthor ? models.sanitise(models.users, dbauthor) : false

  const now = new Date()
  const data = {
    submit: models.sanitise(models.submits, dbsubmit),
    author,
    now: now.toLocaleString()
  }
  //console.log('sendOutMails', data)
  subject = subject(data)
  body = body(data)
  let bcc = bccOwners.join(',')
  console.log('sendMail', dbuser.email, subject)
  utils.async_mail(dbuser.email, subject, body, bcc)

  // Note in sentreminders
  const params = {
    dt: now,
    flowmailruleId: dbmailrule.id,
    submitId: dbsubmit.id,
    userId: dbreviewer.userId,
  }
  const dbsentreminder = await models.sentreminders.create(params)
  if (!dbsentreminder) logger.warn4req(false,'Could not create sentreminder')
}

/* ************************ */

async function background_runner(app) {

  try {
    if (!started) {
      started = true
      console.log('background started start')
      await startup()  // async and then calls runBackground()
    }
    await backgroundTask()
  }
  catch (e) {
    console.log(__filename, e)
    logger.log(__filename, 'background:', e)
  }
}

/* ************************ */

module.exports = background_runner
