const { Router } = require('express')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

const router = Router()

/* ************************ */
/* POST: Add or Delete grading*/
router.post('/gradings/:submitid', async function (req, res, next) {
  //console.log('/gradings/:submitid', req.headers['x-http-method-override'])
  if (req.headers['x-http-method-override'] === 'DELETE') {
    return await deleteGrading(req, res, next)
  }
  if (!('x-http-method-override' in req.headers)) {
    return await addGrading(req, res, next)
  }
  return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST: Delete grading*/
/* ACCESS: OWNER-ONLY TESTED */
async function deleteGrading(req, res, next){
  const submitid = parseInt(req.params.submitid)
  //console.log('DELETE /gradings', submitid)
  try {
    req.dbsubmit = await models.submits.findByPk(submitid)
    if (!req.dbsubmit) return utils.giveup(req, res, 'Cannot find submitid ' + submitid)

    const dbflow = await req.dbsubmit.getFlow()
    if (!dbflow) return utils.giveup(req, res, 'No pub found for submitid ' + submitid)

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, 'No pub found for submitid ' + submitid)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const gradingid = req.body.gradingid
    console.log('DELETE /gradings', submitid, gradingid)

    const dbgrading = await models.submitgradings.findByPk(gradingid)
    if (!dbgrading) return utils.giveup(req, res, 'Cannot find grading ' + gradingid)

    const dbgradingsubmit = await dbgrading.getSubmit()
    if (!dbgradingsubmit) return utils.giveup(req, res, 'Cannot find submit for grading')
    if (dbgradingsubmit.id !== submitid) return utils.giveup(req, res, 'Delete grading submitid mismatch ' + dbgradingsubmit.id + ' ' + submitid)

    await dbgrading.destroy()

    logger.log4req(req, 'DELETED grading', gradingid)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST: Add grading*/
/* ACCESS: OWNER-ONLY TOTEST */
async function addGrading(req, res, next){
  const submitid = parseInt(req.params.submitid)
  //console.log('Add /gradings', submitid)
  try {
    /*const dbflow = await models.flows.findByPk(flowid)
    if (!dbflow) return utils.giveup(req, res, 'Cannot find flowid ' + flowid)

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, 'No pub found for flowid ' + flowid)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const gradingid = req.body.gradingid
    console.log('Add /gradings', submitid, gradingid)

    let ok = false
    if (gradingid) {
      const dbgrading = await models.submitgradings.findByPk(gradingid)
      if (!dbgrading) return utils.giveup(req, res, 'Cannot find grading ' + gradingid)

      const dbgradingflow = await dbgrading.getFlow()
      if (!dbgradingflow) return utils.giveup(req, res, 'Cannot find flow for grading')
      if (dbgradingflow.id !== flowid) return utils.giveup(req, res, 'Edit grading flowid mismatch ' + dbgradingflow.id + ' ' + flowid)

      dbgrading.flowstageId = parseInt(req.body.chosenstage)
      dbgrading.open = req.body.chosenopen
      const chosenstatus = parseInt(req.body.chosenstatus)
      dbgrading.flowstatusId = chosenstatus ? chosenstatus : null

      await dbgrading.save()
      logger.log4req(req, 'UPDATED grading', gradingid)

      ok = true
    } else {
      const params = {
        flowId: flowid,
        flowstageId: parseInt(req.body.chosenstage),
        open: req.body.chosenopen,
      }
      
      const chosenstatus = parseInt(req.body.chosenstatus)
      if (chosenstatus) params.flowstatusId = chosenstatus

      const dbgrading = await models.flowgradings.create(params)
      if (!dbgrading) return utils.giveup(req, res, 'grading not created')
      logger.log4req(req, 'CREATED new grading', dbgrading.id)
      ok = true
    }
    */
    const ok = false
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

module.exports = router
