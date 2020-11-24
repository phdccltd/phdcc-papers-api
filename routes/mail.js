const { Router } = require('express')
const Handlebars = require('handlebars')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

const router = Router()

/* ************************ */
/* GET all mail templates for this publication */
/* ACCESS: OWNER-ONLY NOT TESTED */
router.get('/mail/templates/:pubid', async function (req, res, next) {
  const pubid = parseInt(req.params.pubid)
  // console.log('GET /mail/templates', pubid)
  if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
  try {
    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Get MY roles in all publications - check isowner
    const dbmypubroles = await req.dbuser.getRoles()
    const isowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!isowner) return utils.giveup(req, res, 'Not an owner')

    const dbpubmails = await dbpub.getMailTemplates({ order: [['weight', 'ASC']] })
    const pubmails = models.sanitiselist(dbpubmails, models.pubmailtemplates)

    logger.log4req(req, 'GOT pubmails for pub', pubid)

    utils.returnOK(req, res, pubmails, 'pubmails')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* POST: Add/Edit or Delete mail template */
router.post('/mail/templates/:pubid', async function (req, res, next) {
  // console.log('/mail/templates/:pubid', req.headers['x-http-method-override'])
  if (req.headers['x-http-method-override'] === 'DELETE') {
    return await deleteMailTemplate(req, res, next)
  }
  if (!('x-http-method-override' in req.headers)) {
    return await addEditMailTemplate(req, res, next)
  }
  return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST add/edit mail template for this flow */
/* ACCESS: OWNER-ONLY TESTED */
async function deleteMailTemplate (req, res, next) {
  const pubid = parseInt(req.params.pubid)
  // console.log('DELETE /mail/templates', pubid)
  if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
  try {
    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Get MY roles in all publications - check isowner
    const dbmypubroles = await req.dbuser.getRoles()
    const isowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!isowner) return utils.giveup(req, res, 'Not an owner')

    const templateid = parseInt(req.body.templateid)
    if (isNaN(templateid)) return utils.giveup(req, res, 'Duff templateid')
    const dbmailtemplate = await models.pubmailtemplates.findByPk(templateid)
    if (!dbmailtemplate) return utils.giveup(req, res, 'Cannot find mailtemplate ' + templateid)

    const dbtemplatepub = await dbmailtemplate.getPub()
    if (!dbtemplatepub) return utils.giveup(req, res, 'Cannot find pub for mailtemplate')
    if (dbtemplatepub.id !== pubid) return utils.giveup(req, res, 'Delete mailtemplate pubid mismatch ' + dbtemplatepub.id + ' ' + pubid)

    await dbmailtemplate.destroy()

    logger.log4req(req, 'DELETED mailtemplate', templateid)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST add/edit mail template for this flow */
/* ACCESS: OWNER-ONLY TESTED */
async function addEditMailTemplate (req, res, next) {
  const pubid = parseInt(req.params.pubid)
  // console.log('POST /mail/templates', pubid)
  if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
  try {
    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Get MY roles in all publications - check isowner
    const dbmypubroles = await req.dbuser.getRoles()
    const isowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!isowner) return utils.giveup(req, res, 'Not an owner')

    const templateid = 'templateid' in req.body ? parseInt(req.body.templateid) : 0
    if (isNaN(templateid)) return utils.giveup(req, res, 'Duff templateid')
    const templatename = req.body.templatename
    const templatesubject = req.body.templatesubject
    const templatebody = req.body.templatebody

    let ok = false
    if (templateid) {
      const dbmailtemplate = await models.pubmailtemplates.findByPk(templateid)
      if (!dbmailtemplate) return utils.giveup(req, res, 'Cannot find mailtemplate ' + templateid)

      const dbtemplatepub = await dbmailtemplate.getPub()
      if (!dbtemplatepub) return utils.giveup(req, res, 'Cannot find pub for mailtemplate')
      if (dbtemplatepub.id !== pubid) return utils.giveup(req, res, 'Edit mailtemplate pubid mismatch ' + dbtemplatepub.id + ' ' + pubid)

      dbmailtemplate.name = templatename
      dbmailtemplate.subject = templatesubject
      dbmailtemplate.body = templatebody
      await dbmailtemplate.save()
      logger.log4req(req, 'UPDATED mailtemplate', templateid)
      ok = true
    } else {
      const params = {
        pubId: pubid,
        weight: 0,
        name: templatename,
        subject: templatesubject,
        body: templatebody,
        sendReviewReminderDays: 0,
        sendLeadReminderDays: 0,
        sendReviewChaseUpDays: 0,
        sendOnSiteAction: 0,
        sendOnRoleGiven: 0,
        sendToAuthor: false,
        bccToOwners: false,
        sendToUser: false,
        sendToReviewers: false
      }
      const dbmailtemplate = await models.pubmailtemplates.create(params)
      if (!dbmailtemplate) return utils.giveup(req, res, 'mailtemplate not created')
      logger.log4req(req, 'CREATED new mailtemplate', dbmailtemplate.id)
      ok = true
    }

    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST send mail */
/* ACCESS: OWNER-ONLY NOT TESTED */

router.post('/mail/:pubid', sendMail)

async function sendMail (req, res, next) {
  const pubid = parseInt(req.params.pubid)
  // console.log('POST /mail', pubid)
  if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
  try {
    req.dbpub = await models.pubs.findByPk(pubid)
    if (!req.dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Set req.isowner, req.onlyanauthor and req.myroles for this publication
    if (!await dbutils.getMyRoles(req)) return utils.giveup(req, res, 'No access to this publication')

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    if (!('mailsubject' in req.body)) return utils.giveup(req, res, 'Missing mailsubject')
    if (!('mailtext' in req.body)) return utils.giveup(req, res, 'Missing mailtext')

    const selecteduser = 'selecteduser' in req.body ? parseInt(req.body.selecteduser) : 0
    const selectedrole = 'selectedrole' in req.body ? parseInt(req.body.selectedrole) : 0
    if (isNaN(selecteduser)) return utils.giveup(req, res, 'Duff selecteduser')
    if (isNaN(selectedrole)) return utils.giveup(req, res, 'Duff selectedrole')
    const mailsubject = req.body.mailsubject.trim()
    const mailtext = req.body.mailtext.trim()

    if (mailsubject.length === 0) return utils.giveup(req, res, 'Empty subject')
    if (mailtext.length === 0) return utils.giveup(req, res, 'Empty text')

    const recipients = []
    if (selecteduser > 0) {
      const dbuser = await models.users.findByPk(selecteduser)
      if (!dbuser) return utils.giveup(req, res, 'Invalid selecteduser ' + selecteduser)
      recipients.push(dbuser.email)
    } else {
      const dbusers = await req.dbpub.getUsers()
      if (selectedrole === -1) { // All users
        for (const dbuser of dbusers) {
          recipients.push(dbuser.email)
        }
      }
      if (selectedrole === -2) { // Submitters
        for (const dbuser of dbusers) {
          const dbsubmits = await dbuser.getSubmits()
          if (dbsubmits.length > 0) {
            recipients.push(dbuser.email)
          }
        }
      }
      if (selectedrole > 0) { // Role
        for (const dbuser of dbusers) {
          const dbuserpubroles = await dbuser.getRoles()
          for (const dbuserpubrole of dbuserpubroles) {
            if (dbuserpubrole.id === selectedrole) {
              recipients.push(dbuser.email)
              break
            }
          }
        }
      }
    }
    if (recipients.length === 0) return utils.giveup(req, res, 'No recipients')

    let subject = Handlebars.compile(mailsubject)
    let body = Handlebars.compile(mailtext)

    const dbsite = await req.dbpub.getSite()
    if (!dbsite) {
      logger.log4req(req, 'Could not find site so not sending mails')
      return
    }
    const siteurl = 'https://' + dbsite.url + '/'

    const now = (new Date()).toLocaleString()
    const data = {
      siteurl,
      user: models.sanitise(models.users, req.dbuser),
      now
    }
    subject = subject(data)
    body = body(data)

    for (const recipient of recipients) {
      utils.asyncMail(recipient, subject, body)
    }

    logger.log4req(req, 'Sending mail. Recipients:', recipients.length)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */

module.exports = router
