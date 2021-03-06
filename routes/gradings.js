const { Router } = require('express')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')
const mailutils = require('./mailutils')

const router = Router()

/* ************************ */
/* POST: Add or Delete grading */
router.post('/gradings/:submitid', async function (req, res, next) {
  // console.log('/gradings/:submitid', req.headers['x-http-method-override'])
  if (req.headers['x-http-method-override'] === 'DELETE') {
    return await deleteGrading(req, res, next)
  }
  if (!('x-http-method-override' in req.headers)) {
    return await addGrading(req, res, next)
  }
  return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST: Delete grading */
/* ACCESS: OWNER-ONLY TESTED */
async function deleteGrading (req, res, next) {
  const submitid = parseInt(req.params.submitid)
  const gradingid = parseInt(req.body.gradingid)
  console.log('DELETE /gradings', submitid, gradingid)
  if (isNaN(submitid)) return utils.giveup(req, res, 'Duff submitid')
  if (isNaN(gradingid)) return utils.giveup(req, res, 'Duff gradingid')

  try {
    const error = await dbutils.getSubmitFlowPub(req, submitid)
    if (error) return utils.giveup(req, res, error)

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const dbgrading = await models.submitgradings.findByPk(gradingid)
    if (!dbgrading) return utils.giveup(req, res, 'Cannot find grading ' + gradingid)

    const dbgradingsubmit = await dbgrading.getSubmit()
    if (!dbgradingsubmit) return utils.giveup(req, res, 'Cannot find submit for grading')
    if (dbgradingsubmit.id !== submitid) return utils.giveup(req, res, 'Delete grading submitid mismatch ' + dbgradingsubmit.id + ' ' + submitid)

    await dbgrading.destroy() // Transaction OK

    await dbutils.addActionLog(null, 'delete', req.dbuser.id, req.dbsubmit.userId, req.dbsubmit.id, null, null, null, dbgrading.flowgradeId)

    logger.log4req(req, 'DELETED grading', gradingid)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST: Add grading */
/* ACCESS: OWNER-ONLY EDIT TOTEST
 * TESTS: addGrading OK
 *        addGrading repeat fail
*/
async function addGrading (req, res, next) {
  const submitid = parseInt(req.params.submitid)
  const flowgradeid = parseInt(req.body.flowgradeid)
  const gradingid = req.body.gradingid // If non-zero then editing. Normally undefined
  const flowgradescoreId = parseInt(req.body.decision)
  console.log('Add/Edit /gradings', submitid, gradingid, flowgradescoreId)
  if (isNaN(submitid)) return utils.giveup(req, res, 'Duff submitid')
  if (isNaN(flowgradeid)) return utils.giveup(req, res, 'Duff flowgradeid')
  if (isNaN(flowgradescoreId)) return utils.giveup(req, res, 'Duff decision')
  try {
    const error = await dbutils.getSubmitFlowPub(req, submitid)
    if (error) return utils.giveup(req, res, error)

    const dbflowgrade = await models.flowgrades.findByPk(flowgradeid)
    if (!dbflowgrade) return utils.giveup(req, res, 'flowgradeid not found ' + flowgradeid)
    if (dbflowgrade.flowId !== req.dbflow.id) return utils.giveup(req, res, 'unmatched flowgradeid ' + flowgradeid)

    const flow = await dbutils.getFlowWithFlowgrades(req.dbflow)

    // Re-find flowgrade and check score
    const flowgrade = _.find(flow.flowgrades, _flowgrade => { return _flowgrade.id === flowgradeid })
    if (!flowgrade) return utils.giveup(req, res, 'flowgrade not found' + flowgradeid)
    const flowgradescore = _.find(flowgrade.scores, _score => { return _score.id === flowgradescoreId })
    if (!flowgradescore) return utils.giveup(req, res, 'flowgradescore not found ' + flowgradescoreId)

    if (!await dbutils.getMyRoles(req)) return utils.giveup(req, res, 'No access to this publication')

    if (!req.isowner) {
      if (req.dbsubmit.userId === req.dbuser.id) return utils.giveup(req, res, 'Not allowed') // Can't grade my own submit

      const dbstatuses = await req.dbflow.getFlowStatuses({ order: [['weight', 'ASC']] })
      flow.statuses = models.sanitiselist(dbstatuses, models.flowstatuses)

      const submit = models.sanitise(models.submits, req.dbsubmit)
      await dbutils.getSubmitCurrentStatus(req, req.dbsubmit, submit, flow)
      req.dbsubmitgradings = await req.dbsubmit.getGradings()

      // Check I am OK to grade
      const includethissubmit = await dbutils.isReviewableSubmit(req, flow, false)

      console.log('includethissubmit ihavegraded', includethissubmit, req.ihavegraded)

      if (!includethissubmit) return utils.giveup(req, res, 'Not allowed')
      if (gradingid) return utils.giveup(req, res, 'Not allowed')
      if (req.ihavegraded) return utils.giveup(req, res, 'Not allowed')
    }

    let ok = false
    if (gradingid) { // NOT TESTED YET
      /* const dbgrading = await models.submitgradings.findByPk(gradingid)
      if (!dbgrading) return utils.giveup(req, res, 'Cannot find grading ' + gradingid)

      const dbgradingsubmit = await dbgrading.getSubmit()
      if (!dbgradingsubmit) return utils.giveup(req, res, 'Cannot find submit for grading')
      if (dbgradingsubmit.id !== submitid) return utils.giveup(req, res, 'Edit grading submitid mismatch ' + dbgradingsubmit.id + ' ' + submitid)

      dbgrading.flowgradescoreId = flowgradescoreId
      dbgrading.comment = req.body.comment
      dbgrading.canreview = req.body.canreview

      // await dbgrading.save() // Transaction OK
      // logger.log4req(req, 'UPDATED grading', gradingid)
      */
      // ok = false
    } else {
      const now = new Date()
      const params = {
        dt: now,
        submitId: submitid,
        userId: req.dbuser.id,
        flowgradeId: flowgradeid,
        flowgradescoreId,
        comment: req.body.comment,
        canreview: req.body.canreview
      }
      const dbgrading = await models.submitgradings.create(params) // Transaction OK
      if (!dbgrading) return utils.giveup(req, res, 'grading not created')
      logger.log4req(req, 'CREATED new grading', dbgrading.id)

      await dbutils.addActionLog(null, 'add', req.dbuser.id, req.dbsubmit.userId, req.dbsubmit.id, null, null, null, flowgradeid)

      // Send out mails for this grading
      const grading = models.sanitise(models.submitgradings, dbgrading)
      grading.score = flowgradescore.name
      if (!flowgrade.cancomment) delete grading.comment
      if (flowgrade.canopttoreview) {
        grading.canreview = grading.canreview ? 'Yes' : 'No'
      } else {
        delete grading.canreview
      }
      await mailutils.sendOutMails(req, false, false, dbflowgrade, false, grading)

      ok = true
    }
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

module.exports = router
