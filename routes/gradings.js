const { Router } = require('express')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

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
/* POST: Delete grading */
/* ACCESS: OWNER-ONLY TESTED */
async function deleteGrading(req, res, next){
  const submitid = parseInt(req.params.submitid)
  //console.log('DELETE /gradings', submitid)
  try {
    const error = await dbutils.getSubmitFlowPub(req, submitid)
    if (error) return utils.giveup(req, res, error)

    if (!req.iamowner) return utils.giveup(req, res, 'Not an owner')

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
  const flowgradeid = parseInt(req.body.flowgradeid)
  try {
    const error = await dbutils.getSubmitFlowPub(req, submitid)
    if (error) return utils.giveup(req, res, error)
    if (!req.iamowner) {

      const dbflowgrade = await models.flowgrades.findByPk(flowgradeid)
      if (!dbflowgrade) return utils.giveup(req, res, 'flowgradeid not found' + flowgradeid)
      console.log('dbflowgrade', dbflowgrade.id, dbflowgrade.flowId)
      if (dbflowgrade.flowId !== req.dbflow.id) return utils.giveup(req, res, 'unmatched flowgradeid ' + flowgradeid)

      const submit = models.sanitise(models.submits, req.dbsubmit)
      await dbutils.getSubmitCurrentStatus(req, req.dbsubmit, submit, flow, onlyanauthor)

      // See if I have graded already
      const dbsubmitgradings = await req.dbsubmit.getGradings()
      let ihavegraded = false
      for (const dbsubmitgrading of dbsubmitgradings) {
        if ((flowgradeid === dbsubmitgrading.flowgradeId) && (dbsubmitgrading.userId === req.dbuser.id)) {
          ihavegraded = true
        }
      }
      console.log('ihavegraded', ihavegraded)
      /*if (dbflowgrade.flowstatusId === currentstatus.flowstatusId) { // If we are at status where this grade possible
        //console.log('flowgrade', submit.id, flowgrade.id, flowgrade.name, flowgrade.visibletorole, flowgrade.visibletoreviewers)
        let route = false
        if (flowgrade.visibletorole !== 0) {
          // Check if I have role that means I can grade
          const ihavethisrole = _.find(myroles, roles => { return roles.id === flowgrade.visibletorole })
          if (ihavethisrole) {
            includethissubmit = true
            route = !ihavegraded
          }
        }
        if (flowgrade.visibletoreviewers) {
          // Check if I am reviewer that means I can grade
          const dbreviewers = await dbsubmit.getReviewers()
          for (const dbreviewer of dbreviewers) {
            if (dbreviewer.userId === req.dbuser.id) {
              includethissubmit = true
              route = !ihavegraded
            }
          }
        }
      }*/

      return utils.giveup(req, res, 'Not allowed')
    }

    const gradingid = req.body.gradingid
    console.log('Add/Edit /gradings', submitid, gradingid)

    let ok = false
    if (gradingid) {  // NOT TESTED
      const dbgrading = await models.submitgradings.findByPk(gradingid)
      if (!dbgrading) return utils.giveup(req, res, 'Cannot find grading ' + gradingid)

      const dbgradingsubmit = await dbgrading.getSubmit()
      if (!dbgradingsubmit) return utils.giveup(req, res, 'Cannot find submit for grading')
      if (dbgradingsubmit.id !== submitid) return utils.giveup(req, res, 'Edit grading submitid mismatch ' + dbgradingsubmit.id + ' ' + submitid)

      dbgrading.flowgradescoreId = parseInt(req.body.decision)
      dbgrading.comment = req.body.comment
      dbgrading.canreview = req.body.canreview

      //await dbgrading.save()
      //logger.log4req(req, 'UPDATED grading', gradingid)

      ok = false
    } else {
      const now = new Date()
      const params = {
        dt: now,
        submitId: submitid,
        userId: req.dbuser.id,
        flowgradeId: flowgradeid,
        flowgradescoreId: parseInt(req.body.decision),
        comment: req.body.comment,
        canreview: req.body.canreview,
      }
      console.log("creating", params)
      const dbgrading = await models.submitgradings.create(params)
      if (!dbgrading) return utils.giveup(req, res, 'grading not created')
      logger.log4req(req, 'CREATED new grading', dbgrading.id)
      ok = true
    }
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

module.exports = router
