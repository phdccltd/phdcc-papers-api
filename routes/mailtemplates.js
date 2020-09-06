const { Router } = require('express')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

const router = Router()

/* ************************ */
/* GET all mail templates for this flow */
router.get('/mailtemplates/:flowid', async function (req, res, next) {
  const flowid = parseInt(req.params.flowid)
  console.log('GET /mailtemplates', flowid)
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
router.post('/mailtemplates/:flowid', async function (req, res, next) {
  //console.log('/mailtemplates/:flowid', req.headers['x-http-method-override'])
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
async function deleteMailTemplate(req, res, next) {
  const flowid = parseInt(req.params.flowid)
  //console.log('DELETE /mailtemplates', flowid)
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
async function addEditMailTemplate(req, res, next) {
  const flowid = parseInt(req.params.flowid)
  //console.log('POST /mailtemplates', flowid)
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
    console.log('POST /mailtemplates', templateid, templatename)

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

module.exports = router
