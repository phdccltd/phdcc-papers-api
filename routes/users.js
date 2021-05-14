const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const mailutils = require('./mailutils')

/* ************************ */
/* GET: Get all users */
async function getAllUsers (req, res, next) {
  try {
    // console.log('getAllUsers')
    if (!req.dbuser.super) return utils.giveup(req, res, 'Not a super')

    const allusers = await models.users.findAll({
      order: [
        ['username', 'ASC']
      ]
    })

    logger.log4req(req, 'Returning allusers')
    utils.returnOK(req, res, allusers, 'allusers')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST+DELETE: Delete pub user role  */
async function removePubUser (req, res, next) {
  try {
    if (!('x-http-method-override' in req.headers)) return utils.giveup(req, res, 'No x-http-method-override')
    if (req.headers['x-http-method-override'] !== 'DELETE') return utils.giveup(req, res, 'Not delete')
    const pubid = parseInt(req.params.pubid)
    const userid = parseInt(req.params.userid)
    console.log('removePubUser', pubid, userid)
    if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
    if (isNaN(userid)) return utils.giveup(req, res, 'Duff userid')

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Get MY roles in all publications - check isowner
    const dbmypubroles = await req.dbuser.getRoles()
    const isowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === pubid && mypubrole.isowner }) || req.dbuser.super
    if (!isowner) return utils.giveup(req, res, 'Not an owner')

    const dbuser = await models.users.findByPk(userid)
    if (!dbuser) return utils.giveup(req, res, 'Cannot find userid ' + userid)

    const dbuserpubroles = await dbuser.getRoles()
    if (dbuserpubroles.length > 0) return utils.giveup(req, res, 'Roles need to be deleted first')

    let present = await dbpub.hasUser(dbuser)
    if (!present) return utils.giveup(req, res, 'That user does not have access currently')

    await dbpub.removeUser(dbuser) // Transaction OK

    present = await dbpub.hasUser(dbuser)

    const ok = !present
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST: Create or Delete user role */
async function handleUserRole (req, res, next) {
  // console.log('/users/pub/:pubid/:userid/:roleid', req.headers['x-http-method-override'])
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
async function addUserRole (req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    const userid = parseInt(req.params.userid)
    const roleid = parseInt(req.params.roleid)
    console.log('addUserRole', pubid, userid, roleid)
    if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
    if (isNaN(userid)) return utils.giveup(req, res, 'Duff userid')
    if (isNaN(roleid)) return utils.giveup(req, res, 'Duff roleid')

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Get MY roles in all publications - check isowner
    const dbmypubroles = await req.dbuser.getRoles()
    const isowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === pubid && mypubrole.isowner }) || req.dbuser.super
    if (!isowner) return utils.giveup(req, res, 'Not an owner')

    const dbpubrole = await models.pubroles.findByPk(roleid)
    if (!dbpubrole) return utils.giveup(req, res, 'Cannot find roleid ' + roleid)
    if (dbpubrole.pubId !== dbpub.id) return utils.giveup(req, res, 'pubrole pub mismatch' + dbpubrole.pubId + ' ' + dbpub.id)

    const dbuser = await models.users.findByPk(userid)
    if (!dbuser) return utils.giveup(req, res, 'Cannot find userid ' + userid)

    let present = await dbpubrole.hasUser(dbuser)
    if (present) return utils.giveup(req, res, 'That user already has this role')

    await dbpubrole.addUser(dbuser) // Transaction OK

    present = await dbpubrole.hasUser(dbuser)

    if (present) {
      const dbpubmails = await models.pubmailtemplates.findAll({
        where: {
          pubId: pubid,
          sendOnRoleGiven: roleid
        }
      })
      for (const dbpubmail of dbpubmails) {
        if (dbpubmail.sendToUser) {
          await mailutils.sendOneTemplate(req.dbuser.id, dbpubmail, false, dbpub, false, dbuser, false, false, false, false) // dbuser is user affected, not current user
        }
      }
    }

    const ok = present
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST+DELETE: Delete pub user role  */
async function deleteUserRole (req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    const userid = parseInt(req.params.userid)
    const roleid = parseInt(req.params.roleid)
    console.log('deleteUserRole', pubid, userid, roleid)
    if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
    if (isNaN(userid)) return utils.giveup(req, res, 'Duff userid')
    if (isNaN(roleid)) return utils.giveup(req, res, 'Duff roleid')

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Get MY roles in all publications - check isowner
    const dbmypubroles = await req.dbuser.getRoles()
    const isowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === pubid && mypubrole.isowner }) || req.dbuser.super
    if (!isowner) return utils.giveup(req, res, 'Not an owner')

    const dbpubrole = await models.pubroles.findByPk(roleid)
    if (!dbpubrole) return utils.giveup(req, res, 'Cannot find roleid ' + roleid)
    if (dbpubrole.pubId !== dbpub.id) return utils.giveup(req, res, 'pubrole pub mismatch ' + dbpubrole.pubId + ' ' + dbpub.id)

    const dbuser = await models.users.findByPk(userid)
    if (!dbuser) return utils.giveup(req, res, 'Cannot find userid ' + userid)

    let present = await dbpubrole.hasUser(dbuser)
    if (!present) return utils.giveup(req, res, 'That user does not have this role')

    await dbpubrole.removeUser(dbuser) // Transaction OK

    present = await dbpubrole.hasUser(dbuser)

    const ok = !present
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* GET: Get pub users and their roles */
async function getPubUsers (req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /users/pub/', pubid, req.dbuser.id)
    if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')

    // Get publication
    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    // Get MY roles in all publications - check isowner
    const dbmypubroles = await req.dbuser.getRoles()
    const isowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === pubid && mypubrole.isowner }) || req.dbuser.super
    if (!isowner) return utils.giveup(req, res, 'Not an owner')
    // console.log('isowner', isowner.id, isowner.name)

    const dbflows = await dbpub.getFlows()

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
        const pubrole = _.find(pubroles, _pubrole => { return _pubrole.id === dbuserpubrole.id })
        if (pubrole) user.roles.push(pubrole)
      }

      let userpubsubmitcount = 0
      for (const dbflow of dbflows) {
        const userflowsubmits = await dbuser.getSubmits({ where: { flowId: dbflow.id } })
        userpubsubmitcount += userflowsubmits.length
      }
      user.submitcount = userpubsubmitcount

      users.push(user)
    }

    const pubusers = {
      users,
      pubroles
    }

    // console.log('pubusers', pubusers)
    logger.log4req(req, 'Returning pubusers', pubid)
    utils.returnOK(req, res, pubusers, 'pubusers')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* GET: Masquerade */
async function handleMasquerade (req, res, next) {
  try {
    const userid = parseInt(req.params.userid)
    console.log('GET /users/masquerade/', userid)
    if (isNaN(userid)) return utils.giveup(req, res, 'Duff userid')

    if (!req.dbuser.super) return utils.giveup(req, res, 'No joy')

    const dbuser = await models.users.findByPk(userid)
    if (!dbuser) return utils.giveup(req, res, 'Cannot find userid ' + userid)

    req.dbuser.actas = userid
    req.dbuser.save() // Transaction OK

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

module.exports = {
  removePubUser,
  handleUserRole,
  handleMasquerade,
  getPubUsers,
  getAllUsers
}
