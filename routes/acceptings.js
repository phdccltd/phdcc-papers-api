const { Router } = require('express')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

const router = Router()

/* ************************ */
/* POST: Add/Edit or Delete accepting*/
router.post('/acceptings/:flowid', async function (req, res, next) {
  //console.log('/acceptings/:flowid', req.headers['x-http-method-override'])
  if (req.headers['x-http-method-override'] === 'DELETE') {
    return await deleteAccepting(req, res, next)
  }
  if (!('x-http-method-override' in req.headers)) {
    return await addEditAccepting(req, res, next)
  }
  return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST: Delete accepting*/
async function deleteAccepting(req, res, next){
  const flowid = parseInt(req.params.flowid)
  //console.log('DELETE /acceptings', flowid)
  try {
    const dbflow = await models.flows.findByPk(flowid)
    if (!dbflow) return utils.giveup(req, res, 'Cannot find flowid ' + flowid)

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, 'No pub found for flowid ' + flowid)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const acceptingid = req.body.acceptingid
    console.log('DELETE /acceptings', flowid, acceptingid)

    const dbaccepting = await models.flowacceptings.findByPk(acceptingid)
    if (!dbaccepting) return utils.giveup(req, res, 'Cannot find accepting ' + acceptingid)

    const dbacceptingflow = await dbaccepting.getFlow()
    if (!dbacceptingflow) return utils.giveup(req, res, 'Cannot find flow for accepting')
    if (dbacceptingflow.id !== flowid) return utils.giveup(req, res, 'Delete accepting flowid mismatch ' + dbacceptingflow.id + ' ' + flowid)

    await dbaccepting.destroy()

    logger.log4req(req, 'DELETED accepting', acceptingid)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST: Add/Edit accepting*/
async function addEditAccepting(req, res, next){
  const flowid = parseInt(req.params.flowid)
  //console.log('Add/Edit /acceptings', flowid)
  try {
    const dbflow = await models.flows.findByPk(flowid)
    if (!dbflow) return utils.giveup(req, res, 'Cannot find flowid ' + flowid)

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, 'No pub found for flowid ' + flowid)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const acceptingid = req.body.acceptingid
    console.log('Add/Edit /acceptings', flowid, acceptingid)

    let ok = false
    if (acceptingid) {
      const dbaccepting = await models.flowacceptings.findByPk(acceptingid)
      if (!dbaccepting) return utils.giveup(req, res, 'Cannot find accepting ' + acceptingid)

      const dbacceptingflow = await dbaccepting.getFlow()
      if (!dbacceptingflow) return utils.giveup(req, res, 'Cannot find flow for accepting')
      if (dbacceptingflow.id !== flowid) return utils.giveup(req, res, 'Edit accepting flowid mismatch ' + dbacceptingflow.id + ' ' + flowid)

      dbaccepting.flowstageId = parseInt(req.body.chosenstage)
      dbaccepting.open = req.body.chosenopen
      const chosenstatus = parseInt(req.body.chosenstatus)
      dbaccepting.flowstatusId = chosenstatus ? chosenstatus : null

      await dbaccepting.save()
      logger.log4req(req, 'UPDATED accepting', acceptingid)

      ok = true
    } else {
      const params = {
        flowId: flowid,
        flowstageId: parseInt(req.body.chosenstage),
        open: req.body.chosenopen,
      }
      
      const chosenstatus = parseInt(req.body.chosenstatus)
      if (chosenstatus) params.flowstatusId = chosenstatus

      const dbaccepting = await models.flowacceptings.create(params)
      if (!dbaccepting) return utils.giveup(req, res, 'accepting not created')
      logger.log4req(req, 'CREATED new accepting', dbaccepting.id)
      ok = true
    }

    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

module.exports = router
