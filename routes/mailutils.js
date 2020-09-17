const _ = require('lodash/core')
const Handlebars = require("handlebars")
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

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
    //console.log('sendOutMails dbmailrule', dbmailrule.id, dbmailrule.flowmailtemplateId, dbmailrule.name, dbmailrule.sendToUser, dbmailrule.sendToAuthor, dbmailrule.bccToOwners)

    const bccOwners = []
    if (dbmailrule.bccToOwners) {
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

        let stringvalue = ''
        if (v.string) stringvalue = v.string
        else if (v.text) stringvalue = v.text
        else if (v.integer) stringvalue = v.integer.toString()
        else if (v.file) stringvalue = v.file

        if (formfield) {
          if (formfield.type === 'yes' || formfield.type === 'yesno') {
            stringvalue = v.integer ? 'Yes' : 'No'
          } else if (formfield.type === 'lookup' || formfield.type === 'lookups') {
            stringvalue = ''
            const aselections = v.string.split(',')
            for (const sel of aselections) {
              const dbpublookupvalue = await models.publookupvalues.findByPk(parseInt(sel))
              if (dbpublookupvalue) {
                stringvalue += dbpublookupvalue.text + ' - '
              } else {
                stringvalue += sel + ' - '
              }
            }
          } else if (formfield.type === 'rolelookups') {
            stringvalue = ''
            const aselections = v.string.split(',')
            for (const sel of aselections) {
              const dbuser = await models.users.findByPk(parseInt(sel))
              if (dbuser) {
                stringvalue += dbuser.name + ' - '
              } else {
                stringvalue += sel + ' - '
              }
            }
          }
        }

        entryout['field_' + v.formfieldid] = stringvalue
      }
    }

    const now = (new Date()).toLocaleString()
    const data = {
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
