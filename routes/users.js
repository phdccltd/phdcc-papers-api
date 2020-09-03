const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

/* ************************ */
/* GET: Get pub users and their roles, ie  */
async function getPubUsers(req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /users/pub/', pubid, req.dbuser.id)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === pubid && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')
    console.log('iamowner', iamowner.id, iamowner.name)

    // Get publication
    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot found pubid ' + pubid)

    // Get all roles available for publication
    const pubroles = models.sanitiselist(await dbpub.getPubroles(), models.pubroles)

    // Get all users of this publication, and their roles
    const dbusers = await dbpub.getUsers()
    const users = []
    for (const dbuser of dbusers) {
      const user = models.sanitise(models.users, dbuser)
      user.roles = []
      const dbuserpubroles = await dbuser.getRoles()
      for (const dbuserpubrole of dbuserpubroles) {
        let userpubrole = models.sanitise(models.pubuserroles, dbuserpubrole)
        const pubrole = _.find(pubroles, pubrole => { return pubrole.id === userpubrole.id })
        if (pubrole) userpubrole = pubrole
        user.roles.push(userpubrole)
      }
      users.push(user)
    }

    const pubusers = {
      users,
      pubroles,
    }

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
