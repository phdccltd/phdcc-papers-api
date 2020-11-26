const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

const router = Router()

/* ************************ */
/* POST: Add or Delete reviewer */
router.post('/reviewers/:submitid', async function (req, res, next) {
  // console.log('/reviewers/:submitid', req.headers['x-http-method-override'])
  if (req.headers['x-http-method-override'] === 'DELETE') {
    return await removeReviewer(req, res, next)
  }
  if (!('x-http-method-override' in req.headers)) {
    return await addReviewer(req, res, next)
  }
  return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST: Delete reviewer */
/* ACCESS: OWNER-ONLY TESTED */
async function removeReviewer (req, res, next) {
  const submitid = parseInt(req.params.submitid)
  // console.log('DELETE /reviewers', submitid)
  if (isNaN(submitid)) return utils.giveup(req, res, 'Duff submitid')
  try {
    const error = await dbutils.getSubmitFlowPub(req, submitid)
    if (error) return utils.giveup(req, res, error)

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const submitreviewerid = req.body.submitreviewerid
    // console.log('DELETE /reviewers', submitid, submitreviewerid)
    if (isNaN(submitreviewerid)) return utils.giveup(req, res, 'Duff submitreviewerid')

    const dbsubmitreviewer = await models.submitreviewers.findByPk(submitreviewerid)
    if (!dbsubmitreviewer) return utils.giveup(req, res, 'Cannot find submitreviewer ' + submitreviewerid)

    const dbreviewersubmit = await dbsubmitreviewer.getSubmit()
    if (!dbreviewersubmit) return utils.giveup(req, res, 'Cannot find submit for submitreviewer')
    if (dbreviewersubmit.id !== submitid) return utils.giveup(req, res, 'Delete reviewer submitid mismatch ' + dbreviewersubmit.id + ' ' + submitid)

    await dbsubmitreviewer.destroy()

    logger.log4req(req, 'DELETED submitreviewerid', submitreviewerid)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST: Add reviewer */
/* ACCESS: OWNER-ONLY TESTED */
async function addReviewer (req, res, next) {
  const submitid = parseInt(req.params.submitid)
  console.log('Add /reviewers', submitid)
  if (isNaN(submitid)) return utils.giveup(req, res, 'Duff submitid')
  try {
    const error = await dbutils.getSubmitFlowPub(req, submitid)
    if (error) return utils.giveup(req, res, error)

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const userid = parseInt(req.body.userid)
    console.log('Add /reviewers', submitid, userid, req.body.lead)
    if (isNaN(userid)) return utils.giveup(req, res, 'Duff userid')

    const dbuser = await models.users.findByPk(userid)
    if (!dbuser) return utils.giveup(req, res, 'Could not find userid ' + userid)

    const params = {
      submitId: submitid,
      userId: userid,
      lead: req.body.lead
    }

    const dbsubmitreviewer = await models.submitreviewers.create(params)
    if (!dbsubmitreviewer) return utils.giveup(req, res, 'submitreviewer not created')
    logger.log4req(req, 'CREATED new submitreviewer', dbsubmitreviewer.id)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

module.exports = router
