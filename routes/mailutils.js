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

  let dbpubmails = []
  if (dbflowstatus) {
    dbpubmails = await dbflowstatus.getPubMails()
  } else if (dbflowgrade) {
    dbpubmails = await dbflowgrade.getPubMails()
  }
  for (const dbpubmail of dbpubmails) {

    // Ignore reminder rules
    if (dbpubmail.sendReviewReminderDays !== 0 || dbpubmail.sendLeadReminderDays !== 0 || dbpubmail.sendReviewChaseUpDays !== 0) {
      continue
    }
    //console.log('sendOutMails dbpubmail', dbpubmail.id, dbpubmail.pubmailtemplateId, dbpubmail.name, dbpubmail.sendToUser, dbpubmail.sendToAuthor, dbpubmail.bccToOwners)

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
    if (dbpubmail.bccToOwners) {
      const dbownerroles = await dbpub.getPubroles({ where: { isowner: true } })
      for (const dbownerrole of dbownerroles) {
        const dbownerusers = await dbownerrole.getUsers()
        for (const dbowneruser of dbownerusers) {
          bccOwners.push(dbowneruser.email)
        }
      }
    }

    const recipients = []
    const dbpubrole = await dbpubmail.getPubrole()
    if (dbpubrole) {
      const dbusers = await dbpubrole.getUsers()
      for (const dbuser of dbusers) {
        recipients.push(dbuser.email)
      }
    }

    const dbauthor = await req.dbsubmit.getUser()
    const author = dbauthor ? models.sanitise(models.users, dbauthor) : false
    if (dbpubmail.sendToAuthor && author) {
      recipients.push(author.email)
    }

    if (dbpubmail.sendToUser) {
      recipients.push(req.dbuser.email)
    }

    if (dbpubmail.sendToReviewers) {
      const dbreviewers = await req.dbsubmit.getReviewers()
      for (const dbreviewer of dbreviewers) {
        const dbuser = await dbreviewer.getUser()
        if (dbuser) {
          recipients.push(dbuser.email)
        }
      }
    }

    let subject = Handlebars.compile(dbpubmail.subject)
    let body = Handlebars.compile(dbpubmail.body)

    if (recipients.length === 0) {
      logger.log4req(req, 'No recipients for ' + dbpubmail.name)
      console.log('No recipients for ' + dbpubmail.name)
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
