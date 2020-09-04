const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')


/* ************************ */
/* POST: Create or Delete user role*/
async function handleUserRole(req, res, next) {
  //console.log('/users/pub/:pubid/:userid/:roleid', req.headers['x-http-method-override'])
  if (req.headers['x-http-method-override'] === 'DELETE') {
    return await deleteUserRole(req, res, next)
  }
  if (!('x-http-method-override' in req.headers)) {
    return await addUserRole(req, res, next)
  }
  return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
}

/* ************************ */
/* POST: Add pub user role  */
async function addUserRole(req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    const userid = parseInt(req.params.userid)
    const roleid = parseInt(req.params.roleid)
    console.log('addUserRole', pubid, userid, roleid)

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === pubid && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const dbpubrole = await models.pubroles.findByPk(roleid)
    if (!dbpubrole) return utils.giveup(req, res, 'Cannot find roleid ' + roleid)
    if (dbpubrole.pubId !== dbpub.id) return utils.giveup(req, res, 'pubrole pub mismatch' + dbpubrole.pubId + ' ' + dbpub.id)

    const dbuser = await models.users.findByPk(userid)
    if (!dbuser) return utils.giveup(req, res, 'Cannot find userid ' + userid)

    let present = await dbpubrole.hasUser(dbuser)
    if (present) return utils.giveup(req, res, 'That user already has this role')

    await dbpubrole.addUser(dbuser)

    present = await dbpubrole.hasUser(dbuser)

    const ok = present
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST+DELETE: Delete pub user role  */
async function deleteUserRole(req, res, next) {
  try {
    if (req.headers['x-http-method-override'] !== 'DELETE') return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])

    const pubid = parseInt(req.params.pubid)
    const userid = parseInt(req.params.userid)
    const roleid = parseInt(req.params.roleid)
    console.log('deleteUserRole', pubid, userid, roleid)

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === pubid && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const dbpubrole = await models.pubroles.findByPk(roleid)
    if (!dbpubrole) return utils.giveup(req, res, 'Cannot find roleid ' + roleid)
    if (dbpubrole.pubId !== dbpub.id) return utils.giveup(req, res, 'pubrole pub mismatch' + dbpubrole.pubId+' '+dbpub.id)

    const dbuser = await models.users.findByPk(userid)
    if (!dbuser) return utils.giveup(req, res, 'Cannot find userid ' + userid)

    let present = await dbpubrole.hasUser(dbuser)
    if (!present) return utils.giveup(req, res, 'That user does not have this role')

    await dbpubrole.removeUser(dbuser)

    present = await dbpubrole.hasUser(dbuser)

    const ok = !present
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}


/* ************************ */
/* GET: Get pub users and their roles */
async function getPubUsers(req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /users/pub/', pubid, req.dbuser.id)

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === pubid && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')
    //console.log('iamowner', iamowner.id, iamowner.name)

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

    //console.log('pubusers', pubusers)
    logger.log4req(req, 'Returning pubusers', pubid)
    utils.returnOK(req, res, pubusers, 'pubusers')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

module.exports = {
  handleUserRole,
  getPubUsers,
}
