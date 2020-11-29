const Sequelize = require('sequelize')
const Handlebars = require('handlebars')
const _ = require('lodash/core')
const models = require('./models')
const utils = require('./utils')
const logger = require('./logger')

let started = false

/* ************************ */

async function backgroundTask (testdays) {
  let now = new Date()
  if (testdays) now = new Date(now.getTime() + testdays * 24 * 60 * 60 * 1000)

  // const nowms = now.getTime()  // getTime is in UTC
  console.log('backgroundTask START UTC: ', now)
  try {
    // Find all rules that are reminders
    const dbpubmails = await models.pubmailtemplates.findAll({
      where: {
        [Sequelize.Op.or]: [
          { sendReviewReminderDays: { [Sequelize.Op.gt]: 0 } },
          { sendLeadReminderDays: { [Sequelize.Op.gt]: 0 } },
          { sendReviewChaseUpDays: { [Sequelize.Op.gt]: 0 } }
        ]
      }
    })
    for (const dbpubmail of dbpubmails) {
      // console.log('dbpubmail', dbpubmail.id, dbpubmail.name, dbpubmail.flowstatusId, dbpubmail.flowgradeId)

      // We need to look for submits at this status that haven't been graded at given grade.
      // So, check these two are specified
      if (dbpubmail.flowstatusId === null || dbpubmail.flowgradeId === null) {
        console.log('backgroundTask flowstatusId or flowgradeId null', dbpubmail.id)
        continue
      }

      // Find all submit statuses which have the right status
      const dbsubmitstatuses = await models.submitstatuses.findAll({ where: { flowstatusId: dbpubmail.flowstatusId } })
      for (const dbsubmitstatus of dbsubmitstatuses) {
        // Get the submit of this status
        const dbsubmit = await dbsubmitstatus.getSubmit()
        if (!dbsubmit) {
          console.log('backgroundTask submit not found for status', dbpubmail.id, dbsubmitstatus.id)
          continue
        }
        // Get the statuses of this submit
        const dbstatuses = await dbsubmit.getStatuses({ order: [['id', 'DESC']] })
        if (dbstatuses.length === 0) continue
        // If we're past this status, then don't process rule
        if (dbstatuses[0].id !== dbsubmitstatus.id) continue

        // See if enough time has elapsed to trigger rule
        const elapseddays = (now - dbsubmitstatus.dt) / 1000 / 60 / 60 / 24
        const sendReminder = dbpubmail.sendReviewReminderDays ? elapseddays > dbpubmail.sendReviewReminderDays : false
        const sendLeadReminder = dbpubmail.sendLeadReminderDays ? elapseddays > dbpubmail.sendLeadReminderDays : false
        const sendChaseUp = dbpubmail.sendReviewChaseUpDays ? elapseddays > dbpubmail.sendReviewChaseUpDays : false
        if (!sendReminder && !sendLeadReminder && !sendChaseUp) continue

        const dbgradings = await dbsubmit.getGradings()
        const dbreviewers = await dbsubmit.getReviewers()
        let allReviewsDone = true
        for (const dbreviewer of dbreviewers) {
          const dbsentreminders = await dbpubmail.getSentReminders({ where: { userId: dbreviewer.userId, submitId: dbsubmit.id } })
          if (dbsentreminders.length > 0) continue

          const graded = _.find(dbgradings, (grading) => { return (grading.userId === dbreviewer.userId) && (grading.flowgradeId === dbpubmail.flowgradeId) })
          if (!graded) {
            if (!dbreviewer.lead) allReviewsDone = false
            if (sendReminder && !dbreviewer.lead) {
              await sendMail(dbpubmail, dbsubmit, dbreviewer)
            }
            if (sendLeadReminder && dbreviewer.lead) {
              await sendMail(dbpubmail, dbsubmit, dbreviewer)
            }
          }
        }
        if (sendChaseUp && !allReviewsDone) {
          for (const dbreviewer of dbreviewers) {
            if (dbreviewer.lead) {
              const dbsentreminders = await dbpubmail.getSentReminders({ where: { userId: dbreviewer.userId, submitId: dbsubmit.id } })
              if (dbsentreminders.length > 0) continue

              await sendMail(dbpubmail, dbsubmit, dbreviewer)
            }
          }
        }
      }
    }
  } catch (e) {
    console.log(e.message)
    logger.log(__filename, 'backgroundTask', e.message)
  }
}

/* ************************ */

async function sendMail (dbpubmail, dbsubmit, dbreviewer) {
  const dbuser = await dbreviewer.getUser()
  if (!dbuser) return logger.warn4req(false, 'Could not find user for reviewer')

  let subject = Handlebars.compile(dbpubmail.subject)
  let body = Handlebars.compile(dbpubmail.body)

  const bccOwners = []
  if (dbpubmail.bccToOwners) {
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
  // console.log('sendOutMails', data)
  subject = subject(data)
  body = body(data)
  const bcc = bccOwners.join(',')
  console.log('sendMail', dbuser.email, subject)
  await utils.asyncMail(dbuser.email, subject, body, bcc)

  // Note in sentreminders
  const params = {
    dt: now,
    pubmailtemplateId: dbpubmail.id,
    submitId: dbsubmit.id,
    userId: dbreviewer.userId
  }
  const dbsentreminder = await models.sentreminders.create(params)
  if (!dbsentreminder) logger.warn4req(false, 'Could not create sentreminder')
}

/* ************************ */

async function backgroundRunner (testdays) {
  try {
    if (typeof testdays !== 'number') testdays = 0

    if (!started) {
      started = true
      console.log('background started start')
      await utils.asyncSleep(1000) // Let startup stuff happen
    }
    await backgroundTask(testdays)
  } catch (e) {
    console.log(__filename, e)
    logger.log(__filename, 'background:', e)
  }
}

/* ************************ */

module.exports = backgroundRunner
