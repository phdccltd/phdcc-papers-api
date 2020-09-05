const { Router } = require('express')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')

const router = Router()

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

    utils.returnOK(req, res, mailtemplates, 'mailtemplates')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* POST add/edit mail template for this flow */
router.post('/mailtemplates/:flowid', async function (req, res, next) {
  const flowid = parseInt(req.params.flowid)
  console.log('POST /mailtemplates', flowid)
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
      ok = true
    }

    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

module.exports = router
