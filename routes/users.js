const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

/* ************************ */
/* GET: Get pub users, ie  */
async function getPubUsers(req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /users/pub/', pubid, req.dbuser.id)

    // Get my roles in all publications
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === pubid && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')
    console.log('iamowner', iamowner.id, iamowner.name)

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot found pubid ' + pubid)
    const dbpubroles = await dbpub.getPubroles()

    const pubroles = []
    for (const dbpubrole of dbpubroles) {
      const pubrole = models.sanitise(models.pubroles, dbpubrole)
      pubroles.push(pubrole)
    }

    const pubusers = pubroles // NAH

    console.log('pubusers', pubusers)
    logger.log4req(req, 'Returning pubusers', pubid)
    utils.returnOK(req, res, pubusers, 'pubusers')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

module.exports = {
  getPubUsers
}
