const { Router } = require('express')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')

const router = Router()

/* GET pubs listing. */
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


module.exports = router
