const _ = require('lodash/core')
const Handlebars = require("handlebars")
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

/* ************************ */
// req.dbsubmit must be set
// CHECK: could assume that req.dbflow and req.dbpub set

async function sendOutMails(req, dbflowstatus, dbflowgrade, dbentry, grading) {

  let dbformfields = false
  if (dbentry) {
    dbformfields = await models.formfields.findAll({ where: { formtypeid: dbentry.flowstageId } })
    if (!dbformfields) {
      logger.log4req(req, 'Could not find formfields so not sending mails', dbentry.flowstageId)
      return
    }
  }

  let dbmailrules = []
  if (dbflowstatus) {
    dbmailrules = await dbflowstatus.getFlowMailRules()
  } else if (dbflowgrade) {
    dbmailrules = await dbflowgrade.getFlowMailRules()
  }
  for (const dbmailrule of dbmailrules) {

    // Ignore reminder rules
    if (dbmailrule.sendReviewReminderDays !== 0 || dbmailrule.sendLeadReminderDays !== 0 || dbmailrule.sendReviewChaseUpDays !== 0) {
      continue
    }
    //console.log('sendOutMails dbmailrule', dbmailrule.id, dbmailrule.flowmailtemplateId, dbmailrule.name, dbmailrule.sendToUser, dbmailrule.sendToAuthor, dbmailrule.bccToOwners)

    const dbflow = await req.dbsubmit.getFlow()
    if (!dbflow) {
      logger.log4req(req, 'Could not find flow so not sending mails')
      return
    }
    const dbpub = await dbflow.getPub()
    if (!dbpub) {
      logger.log4req(req, 'Could not find pub so not sending mails')
      return
    }

    const bccOwners = []
    if (dbmailrule.bccToOwners) {
      const dbownerroles = await dbpub.getPubroles({ where: { isowner: true } })
      for (const dbownerrole of dbownerroles) {
        const dbownerusers = await dbownerrole.getUsers()
        for (const dbowneruser of dbownerusers) {
          bccOwners.push(dbowneruser.email)
        }
      }
    }

    const recipients = []
    const dbpubrole = await dbmailrule.getPubrole()
    if (dbpubrole) {
      const dbusers = await dbpubrole.getUsers()
      for (const dbuser of dbusers) {
        recipients.push(dbuser.email)
      }
    }

    const dbauthor = await req.dbsubmit.getUser()
    const author = dbauthor ? models.sanitise(models.users, dbauthor) : false
    if (dbmailrule.sendToAuthor && author) {
      recipients.push(author.email)
    }

    if (dbmailrule.sendToUser) {
      recipients.push(req.dbuser.email)
    }

    if (dbmailrule.sendToReviewers) {
      const dbreviewers = await req.dbsubmit.getReviewers()
      for (const dbreviewer of dbreviewers) {
        const dbuser = await dbreviewer.getUser()
        if (dbuser) {
          recipients.push(dbuser.email)
        }
      }
    }

    const dbtemplate = await dbmailrule.getFlowmailtemplate()
    let subject = Handlebars.compile(dbtemplate.subject)
    let body = Handlebars.compile(dbtemplate.body)

    if (recipients.length === 0) {
      logger.log4req(req, 'No recipients for ' + dbtemplate.name)
      console.log('No recipients for ' + dbtemplate.name)
      continue
    }
    //console.log('recipients', recipients.join(','))

    let entryout = false
    if (dbentry) {
      entryout = models.sanitise(models.entries, dbentry)
      for (const sv of req.body.values) {
        const v = JSON.parse(sv)
        const formfield = _.find(dbformfields, formfield => { return formfield.id === v.formfieldid })
        entryout['field_' + v.formfieldid] = await dbutils.getEntryStringValue(v, formfield)
      }
    }

    const dbsite = await dbpub.getSite()
    if (!dbsite) {
      logger.log4req(req, 'Could not find site so not sending mails')
      return
    }
    const siteurl = 'https://' + dbsite.url + '/'

    const now = (new Date()).toLocaleString()
    const data = {
      siteurl,
      submit: models.sanitise(models.submits, req.dbsubmit),
      entry: entryout,
      grading,
      author,
      user: models.sanitise(models.users, req.dbuser),
      now,
    }
    //console.log('sendOutMails', data)
    subject = subject(data)
    body = body(data)
    let bcc = bccOwners.join(',')
    for (const recipient of recipients) {
      utils.async_mail(recipient, subject, body, bcc)
      bcc = false
    }
  }
}

/* ************************ */

module.exports = {
  sendOutMails,
}
