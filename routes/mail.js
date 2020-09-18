const { Router } = require('express')
const Sequelize = require('sequelize')
const Handlebars = require("handlebars")
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

const router = Router()

/* ************************ */
/* GET all mail templates for this flow */
/* ACCESS: OWNER-ONLY NOT TESTED */
router.get('/mail/templates/:flowid', async function (req, res, next) {
  const flowid = parseInt(req.params.flowid)
  //console.log('GET /mail/templates', flowid)
  try {
    const dbflow = await models.flows.findByPk(flowid)
    if (!dbflow) return utils.giveup(req, res, 'Cannot find flowid ' + flowid)

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, 'No pub found for flowid ' + flowid)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const dbmailtemplates = await dbflow.getFlowMailTemplates()
    const mailtemplates = models.sanitiselist(dbmailtemplates, models.flowmailtemplates)

    logger.log4req(req, 'GOT mailtemplates for flow', flowid)

    utils.returnOK(req, res, mailtemplates, 'mailtemplates')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* POST: Add/Edit or Delete mail template */
router.post('/mail/templates/:flowid', async function (req, res, next) {
  //console.log('/mail/templates/:flowid', req.headers['x-http-method-override'])
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
/* ACCESS: OWNER-ONLY NOT TESTED */
async function deleteMailTemplate(req, res, next) {
  const flowid = parseInt(req.params.flowid)
  //console.log('DELETE /mail/templates', flowid)
  try {
    const dbflow = await models.flows.findByPk(flowid)
    if (!dbflow) return utils.giveup(req, res, 'Cannot find flowid ' + flowid)

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, 'No pub found for flowid ' + flowid)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const templateid = req.body.templateid
    const dbmailtemplate = await models.flowmailtemplates.findByPk(templateid)
    if (!dbmailtemplate) return utils.giveup(req, res, 'Cannot find mailtemplate ' + templateid)

    const dbtemplatesflow = await dbmailtemplate.getFlow()
    if (!dbtemplatesflow) return utils.giveup(req, res, 'Cannot find flow for mailtemplate')
    if (dbtemplatesflow.id !== flowid) return utils.giveup(req, res, 'Edit mailtemplate flowid mismatch ' + dbtemplatesflow.id + ' ' + flowid)

    await dbmailtemplate.destroy()

    logger.log4req(req, 'DELETED mailtemplate', templateid)

    ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST add/edit mail template for this flow */
/* ACCESS: OWNER-ONLY NOT TESTED */
async function addEditMailTemplate(req, res, next) {
  const flowid = parseInt(req.params.flowid)
  //console.log('POST /mail/templates', flowid)
  try {
    const dbflow = await models.flows.findByPk(flowid)
    if (!dbflow) return utils.giveup(req, res, 'Cannot find flowid ' + flowid)

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, 'No pub found for flowid ' + flowid)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const templateid = req.body.templateid
    const templatename = req.body.templatename
    const templatesubject = req.body.templatesubject
    const templatebody = req.body.templatebody

    let ok = false
    if (templateid) {
      const dbmailtemplate = await models.flowmailtemplates.findByPk(templateid)
      if (!dbmailtemplate) return utils.giveup(req, res, 'Cannot find mailtemplate ' + templateid)

      const dbtemplatesflow = await dbmailtemplate.getFlow()
      if (!dbtemplatesflow) return utils.giveup(req, res, 'Cannot find flow for mailtemplate')
      if (dbtemplatesflow.id !== flowid) return utils.giveup(req, res, 'Edit mailtemplate flowid mismatch ' + dbtemplatesflow.id + ' ' + flowid)

      dbmailtemplate.name = templatename
      dbmailtemplate.subject = templatesubject
      dbmailtemplate.body = templatebody
      await dbmailtemplate.save()
      logger.log4req(req, 'UPDATED mailtemplate', templateid)
      ok = true
    } else {
      const params = {
        flowId: flowid,
        name: templatename,
        subject: templatesubject,
        body: templatebody,
      }
      const dbmailtemplate = await models.flowmailtemplates.create(params)
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

async function sendMail(req, res, next) {
  const pubid = parseInt(req.params.pubid)
  //console.log('POST /mail', pubid)
  try {
    req.dbpub = await models.pubs.findByPk(pubid)
    if (!req.dbpub) return utils.giveup(req, res, 'Invalid pubs:id')

    // Set req.iamowner, req.onlyanauthor and req.myroles for this publication
    await dbutils.getMyRoles(req)

    if (!req.iamowner) return utils.giveup(req, res, 'Not owner')

    const selecteduser = parseInt(req.body.selecteduser)
    const selectedrole = parseInt(req.body.selectedrole)
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
      if (selectedrole === -1) {  // All users
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

    const now = (new Date()).toLocaleString()
    const data = {
      user: models.sanitise(models.users, req.dbuser),
      now,
    }
    subject = subject(data)
    body = body(data)

    for (const recipient of recipients) {
      utils.async_mail(recipient, subject, body)
    }

    logger.log4req(req, 'Sending mail. Recipients:', recipients.length)

    let ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */

module.exports = router
