const { Router } = require('express')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

const router = Router()

/* ************************ */
/* POST: Add or Delete reviewer*/
router.post('/reviewers/:submitid', async function (req, res, next) {
  //console.log('/reviewers/:submitid', req.headers['x-http-method-override'])
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
async function removeReviewer(req, res, next){
  const submitid = parseInt(req.params.submitid)
  //console.log('DELETE /reviewers', submitid)
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

    const submitreviewerid = req.body.submitreviewerid
    //console.log('DELETE /reviewers', submitid, submitreviewerid)

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
/* POST: Add reviewer*/
/* ACCESS: OWNER-ONLY TESTED */
async function addReviewer(req, res, next){
  const submitid = parseInt(req.params.submitid)
  console.log('Add /reviewers', submitid)
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

    const userid = req.body.userid
    console.log('Add /reviewers', submitid, userid, req.body.lead)

    const params = {
      submitId: submitid,
      userId: parseInt(userid),
      lead: req.body.lead,
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
