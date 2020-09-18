const Sequelize = require('sequelize')
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
    for (const dbflowmailrule of dbflowmailrules) {
      console.log('dbflowmailrule', dbflowmailrule.id, dbflowmailrule.name, dbflowmailrule.flowstatusId, dbflowmailrule.flowgradeId)

      if (dbflowmailrule.flowstatusId === null || dbflowmailrule.flowgradeId === null) {
        console.log('backgroundTask flowstatusId or flowgradeId null', dbflowmailrule.id)
        continue
      }

      // Find all submit statuses which have the right status
      const dbsubmitstatuses = await models.submitstatuses.findAll({ where: { flowstatusId: dbflowmailrule.flowstatusId } })
      for (const dbsubmitstatus of dbsubmitstatuses) {
        console.log('-- dbsubmitstatus', dbsubmitstatus.id, dbsubmitstatus.dt)
        // Get the submit of this status
        const dbsubmit = await dbsubmitstatus.getSubmit()
        if (!dbsubmit) {
          console.log('backgroundTask submit not found for status', dbflowmailrule.id, dbsubmitstatus.id)
          continue
        }
        // Get the statuses of this submit
        const dbstatuses = await dbsubmit.getStatuses({ order: [['id', 'DESC']] })
        if (dbstatuses.length === 0) continue
        // If we're past this status, then don't process rule
        if (dbstatuses[0].id !== dbsubmitstatus.id) continue

        // See if enough time has elapsed to trigger rule
        const elapseddays = (now - dbsubmitstatus.dt) / 1000 / 60 / 60 / 24
        console.log('Submit', dbsubmit.id, 'at this status', dbsubmitstatus.dt, elapseddays)
        const sendReminder = dbflowmailrule.sendReviewReminderDays ? elapseddays > dbflowmailrule.sendReviewReminderDays : false
        const sendLeadReminder = dbflowmailrule.sendLeadReminderDays ? elapseddays > dbflowmailrule.sendLeadReminderDays : false
        const sendChaseUp = dbflowmailrule.sendReviewChaseUpDays ? elapseddays > dbflowmailrule.sendReviewChaseUpDays : false
        if (!sendReminder && !sendLeadReminder && !sendChaseUp) continue
        console.log('sendReminder || sendLeadReminder || sendChaseUp')

        const dbgradings = await dbsubmit.getGradings()
        const dbreviewers = await dbsubmit.getReviewers()
        let allReviewsDone = true
        for (const dbreviewer of dbreviewers) {
          console.log('dbreviewer', dbreviewer.id, dbreviewer.userId, dbreviewer.lead)

          const sentReminders = await dbflowmailrule.getSentReminders({ where: { userId: dbreviewer.userId } })
          if (sentReminders.length > 0) {
            console.log('- Reminder already sent')
            continue
          }
          console.log('+ Reminder may be needed')
          const graded = _.find(dbgradings, (grading) => { return grading.userId == dbreviewer.userId })
          if (!graded) {
            allReviewsDone = false
            if (sendReminder && !dbreviewer.lead) {
              console.log('  + Reviewer', dbreviewer.userId, 'NOT graded: SEND REMINDER to non-lead!!')
            }
            if (sendLeadReminder && dbreviewer.lead) {
              console.log('  + Lead', dbreviewer.userId, 'NOT graded: SEND REMINDER to lead!!')
            }
          }
        }
        if (sendChaseUp && !allReviewsDone) {
          console.log('=== Not all reviews done: SEND REMINDER to leads')
          for (const dbreviewer of dbreviewers) {
            if (dbreviewer.lead) {
              console.log('    Lead', dbreviewer.userId)
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
