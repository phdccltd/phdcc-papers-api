const _ = require('lodash/core')
const Handlebars = require('handlebars')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

/* ************************ */
// req.dbsubmit must be set
// CHECK: could assume that req.dbflow and req.dbpub set

async function sendOutMails (req, dbflowstage, dbflowstatus, dbflowgrade, dbentry, grading) {
  let dbformfields = false
  if (dbentry) {
    dbformfields = await models.formfields.findAll({ where: { formtypeid: dbentry.flowstageId } })
    if (!dbformfields) {
      logger.log4req(req, 'Could not find formfields so not sending mails', dbentry.flowstageId)
      return
    }
  }

  let dbpubmails = []
  if (dbflowstage) {
    dbpubmails = await dbflowstage.getPubMails()
  } else if (dbflowstatus) {
    dbpubmails = await dbflowstatus.getPubMails()
  } else if (dbflowgrade) {
    dbpubmails = await dbflowgrade.getPubMails()
  }
  for (const dbpubmail of dbpubmails) {
    // Ignore reminder rules
    if (dbpubmail.sendReviewReminderDays !== 0 || dbpubmail.sendLeadReminderDays !== 0 || dbpubmail.sendReviewChaseUpDays !== 0) {
      continue
    }
    // console.log('sendOutMails dbpubmail', dbpubmail.id, dbpubmail.pubmailtemplateId, dbpubmail.name, dbpubmail.sendToUser, dbpubmail.sendToAuthor, dbpubmail.bccToOwners)

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

    await sendOneTemplate(req.dbuser.id, dbpubmail, false, dbpub, dbformfields, req.dbuser, req.dbsubmit, dbentry, grading, req.body)
  }
}

/* ************************ */

async function sendOneTemplate (dbuserid, dbpubmail, site, dbpub, dbformfields, dbuser, dbsubmit, dbentry, grading, reqbody, data) {
  const bccOwners = []
  const bccEmails = []
  if (dbpub && dbpubmail.bccToOwners) {
    const dbownerroles = await dbpub.getPubroles({ where: { isowner: true } })
    for (const dbownerrole of dbownerroles) {
      const dbownerusers = await dbownerrole.getUsers()
      for (const dbowneruser of dbownerusers) {
        bccOwners.push(dbowneruser)
        bccEmails.push(dbowneruser.email)
      }
    }
  }

  const recipients = []
  const dbpubrole = await dbpubmail.getPubrole()
  if (dbpubrole) {
    const dbroleusers = await dbpubrole.getUsers()
    for (const dbroleuser of dbroleusers) {
      recipients.push(dbroleuser)
    }
  }

  let author = false
  if (dbsubmit) {
    const dbauthor = await dbsubmit.getUser()
    author = dbauthor ? models.sanitise(models.users, dbauthor) : false
    if (dbpubmail.sendToAuthor && author) {
      recipients.push(author)
    }
  }

  if (dbpubmail.sendToUser) {
    recipients.push(dbuser)
  }

  if (dbsubmit && dbpubmail.sendToReviewers) {
    const dbreviewers = await dbsubmit.getReviewers()
    for (const dbreviewer of dbreviewers) {
      const dbuser2 = await dbreviewer.getUser()
      if (dbuser2) {
        recipients.push(dbuser2)
      }
    }
  }

  // If need be, set noEscape to true to allow HTML: https://handlebarsjs.com/api-reference/compilation.html
  // Characters such as ' and & are currently escaped into &#x27; and &amp; which could be undone.
  let subject = Handlebars.compile(dbpubmail.subject, { noEscape: false })
  let body = Handlebars.compile(dbpubmail.body, { noEscape: false })

  if (recipients.length === 0 && bccOwners.length === 0) {
    logger.log('No recipients for ' + dbpubmail.name)
    console.log('No recipients for ' + dbpubmail.name)
    return
  }
  // console.log('recipients', recipients.join(','))

  let entryout = false
  if (dbentry) {
    entryout = models.sanitise(models.entries, dbentry)
    const svalues = (typeof reqbody.values === 'string') ? [reqbody.values] : reqbody.values // Single value comes in as string; otherwise array
    for (const sv of svalues) {
      const v = JSON.parse(sv)
      const formfield = _.find(dbformfields, _formfield => { return _formfield.id === v.formfieldid })
      entryout['field_' + v.formfieldid] = await dbutils.getEntryStringValue(v, formfield)
    }
  }

  if (!site) {
    site = await dbpub.getSite()
    if (!site) { console.log('No site for pub'); return }
  }
  site = { name: site.name, url: 'https://' + site.url + '/', publicsettings: site.publicsettings }

  const now = (new Date()).toLocaleString()
  if (!data) data = {}
  data.site = site
  data.pub = models.sanitise(models.pubs, dbpub)
  data.submit = models.sanitise(models.submits, dbsubmit)
  data.entry = entryout
  data.grading = grading
  data.author = author
  data.user = models.sanitise(models.users, dbuser)
  data.now = now
  // console.log('sendOutMails', data)
  subject = subject(data)
  body = body(data)
  const bcc = bccEmails.join(',')
  const submitId = dbsubmit ? dbsubmit.id : null
  const entryId = dbentry ? dbentry.id : null
  if (recipients.length > 0) {
    for (const recipient of recipients) {
      utils.asyncMail(recipient.email, subject, body, bcc)
      await dbutils.addActionLog(null, 'add', dbuserid, recipient.id, submitId, entryId, null, null, null, dbpubmail.id)
      // bcc = false
    }
  } else {
    for (const bccEmail of bccEmails) {
      utils.asyncMail(bccEmail, subject, body, false)
    }
  }
  for (const bccOwner of bccOwners) {
    await dbutils.addActionLog(null, 'add', dbuserid, bccOwner.id, submitId, entryId, null, null, null, dbpubmail.id)
  }
}
/* ************************ */

module.exports = {
  sendOutMails,
  sendOneTemplate
}
