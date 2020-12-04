const { Router } = require('express')
const Sequelize = require('sequelize')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

const router = Router()

/* ************************ */
/* POST: Add/Edit or Delete accepting */
router.post('/acceptings/:flowid', async function (req, res, next) {
  // console.log('/acceptings/:flowid', req.headers['x-http-method-override'])
  if (req.headers['x-http-method-override'] === 'DELETE') {
    return await deleteAccepting(req, res, next)
  }
  if (!('x-http-method-override' in req.headers)) {
    return await addEditAccepting(req, res, next)
  }
  return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST: Delete accepting */
/* ACCESS: OWNER-ONLY TOTEST */
async function deleteAccepting (req, res, next) {
  const flowid = parseInt(req.params.flowid)
  // console.log('DELETE /acceptings', flowid)
  if (isNaN(flowid)) return utils.giveup(req, res, 'Duff flowid')
  try {
    req.dbflow = await models.flows.findByPk(flowid)
    if (!req.dbflow) return utils.giveup(req, res, 'Cannot find flowid ' + flowid)

    req.dbpub = await req.dbflow.getPub()
    if (!req.dbpub) return utils.giveup(req, res, 'No pub found for flowid ' + flowid)

    if (!await dbutils.getMyRoles(req)) return utils.giveup(req, res, 'No access to this publication')
    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const acceptingid = parseInt(req.body.acceptingid)
    console.log('DELETE /acceptings', flowid, acceptingid)
    if (isNaN(acceptingid)) return utils.giveup(req, res, 'Duff acceptingid')

    const dbaccepting = await models.flowacceptings.findByPk(acceptingid)
    if (!dbaccepting) return utils.giveup(req, res, 'Cannot find accepting ' + acceptingid)

    const dbacceptingflow = await dbaccepting.getFlow()
    if (!dbacceptingflow) return utils.giveup(req, res, 'Cannot find flow for accepting')
    if (dbacceptingflow.id !== flowid) return utils.giveup(req, res, 'Delete accepting flowid mismatch ' + dbacceptingflow.id + ' ' + flowid)

    await dbaccepting.destroy() // Transaction OK

    logger.log4req(req, 'DELETED accepting', acceptingid)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST: Add/Edit accepting */
/* ACCESS: OWNER-ONLY TOTEST */
async function addEditAccepting (req, res, next) {
  const flowid = parseInt(req.params.flowid)
  // console.log('Add/Edit /acceptings', flowid)
  if (isNaN(flowid)) return utils.giveup(req, res, 'Duff flowid')
  try {
    req.dbflow = await models.flows.findByPk(flowid)
    if (!req.dbflow) return utils.giveup(req, res, 'Cannot find flowid ' + flowid)

    req.dbpub = await req.dbflow.getPub()
    if (!req.dbpub) return utils.giveup(req, res, 'No pub found for flowid ' + flowid)

    if (!await dbutils.getMyRoles(req)) return utils.giveup(req, res, 'No access to this publication')
    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const acceptingid = req.body.acceptingid
    console.log('Add/Edit /acceptings', flowid, acceptingid)

    const chosenstage = parseInt(req.body.chosenstage)
    if (isNaN(chosenstage)) return utils.giveup(req, res, 'Duff chosenstage')
    const chosenstatus = 'chosenstatus' in req.body ? ((req.body.chosenstatus === null) ? 0 : parseInt(req.body.chosenstatus)) : 0
    console.log('chosenstatus', chosenstatus, req.body.chosenstatus)
    if (isNaN(chosenstatus)) return utils.giveup(req, res, 'Duff chosenstatus')

    let ok = false
    if (acceptingid) {
      const dbacceptings = await models.flowacceptings.findAll({
        where: {
          flowId: flowid,
          flowstageId: chosenstage,
          id: { [Sequelize.Op.ne]: acceptingid }
        }
      })
      if (dbacceptings.length > 0) return utils.giveup(req, res, 'Cannot add another accepting for this stage. Please edit the existing one.')

      if (isNaN(parseInt(acceptingid))) return utils.giveup(req, res, 'Duff acceptingid')
      const dbaccepting = await models.flowacceptings.findByPk(acceptingid)
      if (!dbaccepting) return utils.giveup(req, res, 'Cannot find accepting ' + acceptingid)

      const dbacceptingflow = await dbaccepting.getFlow()
      if (!dbacceptingflow) return utils.giveup(req, res, 'Cannot find flow for accepting')
      if (dbacceptingflow.id !== flowid) return utils.giveup(req, res, 'Edit accepting flowid mismatch ' + dbacceptingflow.id + ' ' + flowid)

      dbaccepting.flowstageId = chosenstage
      dbaccepting.open = req.body.chosenopen
      dbaccepting.flowstatusId = chosenstatus || null

      await dbaccepting.save() // Transaction OK
      logger.log4req(req, 'UPDATED accepting', acceptingid)

      ok = true
    } else {
      const dbacceptings = await models.flowacceptings.findAll({
        where: {
          flowId: flowid,
          flowstageId: chosenstage
        }
      })
      if (dbacceptings.length > 0) return utils.giveup(req, res, 'Cannot add another accepting for this stage. Please edit the existing one.')

      const params = {
        flowId: flowid,
        flowstageId: chosenstage,
        open: req.body.chosenopen
      }

      if (chosenstatus) params.flowstatusId = chosenstatus

      const dbaccepting = await models.flowacceptings.create(params) // Transaction OK
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
