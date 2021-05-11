const { Router } = require('express')
// const Sequelize = require('sequelize')
const _ = require('lodash/core')
const sequelize = require('../db')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

const router = Router()

/* GET pubs listing */
router.get('/pubs', async function (req, res, next) {
  // console.log('GET /pubs')

  try {
    const order = {
      order: [
        ['startdate', 'ASC']
      ]
    }
    let dbpubs = false
    if (req.dbuser.super) {
      dbpubs = await models.pubs.findAll(order)
    } else {
      dbpubs = await req.dbuser.getPublications(order)
    }

    // Get my roles in all publications
    const dbmypubroles = await req.dbuser.getRoles()

    // Sanitise and get associated publookups/publookupvalues
    const pubs = []
    for (const dbpub of dbpubs) {
      const pub = models.sanitise(models.pubs, dbpub)
      pub.apiversion = process.env.version // Bit naff
      delete pub.email

      // Set isowner and myroles for this publication
      pub.isowner = false
      pub.myroles = []
      for (const dbmypubrole of dbmypubroles) {
        if (dbmypubrole.pubId === pub.id) {
          const mypubrole = models.sanitise(models.pubroles, dbmypubrole)
          pub.myroles.push(mypubrole)
          if (mypubrole.isowner) pub.isowner = true
        }
      }
      // pub.isowner = true // When testing add this fake ownership so subsequent tests fail

      // Don't list disabled pubs for ordinary users
      if (!req.dbuser.super && !pub.isowner && !pub.enabled) continue

      const dbpubroles = await dbpub.getPubroles()
      pub.pubroles = models.sanitiselist(dbpubroles, models.pubroles)

      pub.publookups = []
      const dbpublookups = await dbpub.getPubLookups()
      for (const dbpublookup of dbpublookups) {
        const publookup = models.sanitise(models.publookups, dbpublookup)
        const dbpublookupvalues = await dbpublookup.getPubLookupValues({
          order: [
            ['weight', 'ASC']
          ]
        })
        publookup.values = models.sanitiselist(dbpublookupvalues, models.publookupvalues)
        pub.publookups.push(publookup)
      }

      pub.reviewers = []
      if (pub.isowner) {
        for (const dbpubrole of dbpubroles) {
          if (dbpubrole.isreviewer) {
            const dbreviewers = await dbpubrole.getUsers()
            for (const dbreviewer of dbreviewers) {
              const alreadyin = _.find(pub.reviewers, (reviewer) => { return reviewer.id === dbreviewer.id })
              if (!alreadyin) {
                pub.reviewers.push({ id: dbreviewer.id, name: dbreviewer.name, roles: dbpubrole.name })
              } else {
                alreadyin.roles += ', ' + dbpubrole.name
              }
            }
          }
        }
      }

      // If super then add user and role info for super admin screen
      if (req.dbuser.super) {
        const dbsuperpubroles = await dbpub.getPubroles()
        pub.superpubroles = []
        for (const dbpubrole of dbsuperpubroles) {
          const pubrole = models.sanitise(models.pubroles, dbpubrole)
          const pubusers = await dbpubrole.getUsers()
          pubrole.users = models.sanitiselist(pubusers, models.users)
          pub.superpubroles.push(pubrole)
        }
      }

      pubs.push(pub)
    }
    utils.returnOK(req, res, pubs, 'pubs')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* POST: create publication */
router.post('/pubs', async function (req, res, next) {
  try {
    if (!req.dbuser.super) return utils.giveup(req, res, 'Not a super')

    if (!('pubname' in req.body)) return utils.giveup(req, res, 'pubname missing')
    const pubname = req.body.pubname.trim()
    if (pubname.length === 0) return utils.giveup(req, res, 'pubname empty')

    if (!('pubdescr' in req.body)) return utils.giveup(req, res, 'pubdescr missing')
    const pubdescr = req.body.pubdescr.trim()
    if (pubdescr.length === 0) return utils.giveup(req, res, 'pubdescr empty')

    // Make an alias. Not used for now so doesn't matter if duplicate
    let alias = req.site.url.split('.').reverse().join('.') // eg from 'papers.phdcc.com' to 'com.phdcc.papers'
    alias += '.' + pubname.toLowerCase().replace(/ /g, '-')

    const pub = {
      siteId: req.site.id,
      alias,
      name: pubname,
      title: pubname,
      description: pubdescr,
      email: ''
    }
    const dbpub = await models.pubs.create(pub) // Transaction OK
    if (!dbpub) return utils.giveup(req, res, 'Could not create publication')

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* POST bulk op: for all submits at FROM status, add new TO status */
router.post('/pubs/bulk/:pubid', async function (req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
    const fromstatus = parseInt(req.body.fromstatus)
    if (isNaN(fromstatus)) return utils.giveup(req, res, 'Duff fromstatus')
    const tostatus = parseInt(req.body.tostatus)
    if (isNaN(tostatus)) return utils.giveup(req, res, 'Duff tostatus')
    console.log('POST /pubs', pubid, fromstatus, tostatus)

    req.dbpub = await models.pubs.findByPk(pubid)
    if (!req.dbpub) return utils.giveup(req, res, 'Invalid pubs:id')

    if (!await dbutils.getMyRoles(req)) return utils.giveup(req, res, 'No access to this publication')
    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const dbfromstatus = await models.flowstatuses.findByPk(fromstatus)
    if (!dbfromstatus) return utils.giveup(req, res, 'Cannot find fromstatus ' + fromstatus)
    const dbtostatus = await models.flowstatuses.findByPk(tostatus)
    if (!dbtostatus) return utils.giveup(req, res, 'Cannot find tostatus ' + tostatus)
    if (dbfromstatus.flowId !== dbtostatus.flowId) return utils.giveup(req, res, 'fromstatus and tostatus flow mismatch')

    let countAtFromStatus = 0
    const dbflows = await req.dbpub.getFlows()
    for (const dbflow of dbflows) {
      const flow = await dbutils.getFlowWithFlowgrades(dbflow)
      const dbstatuses = await dbflow.getFlowStatuses({ order: [['weight', 'ASC']] })
      flow.statuses = models.sanitiselist(dbstatuses, models.flowstatuses)

      const dbsubmits = await dbflow.getSubmits()
      for (const dbsubmit of dbsubmits) {
        const submit = models.sanitise(models.submits, dbsubmit)
        await dbutils.getSubmitCurrentStatus(req, dbsubmit, submit, flow)
        if (!req.currentstatus) continue // If no statuses, then ignore
        if (req.currentstatus.flowstatusId === fromstatus) {
          countAtFromStatus++

          const now = new Date()
          const submitstatus = {
            dt: now,
            submitId: dbsubmit.id,
            flowstatusId: tostatus
          }
          const dbsubmitstatus = await models.submitstatuses.create(submitstatus) // Transaction OK - even if we fail after some done
          if (!dbsubmitstatus) return utils.giveup(req, res, 'Could not create submitstatus')
          logger.log4req(req, 'Created submit status', dbsubmit.id, tostatus, dbsubmitstatus.id)
          await dbutils.addActionLog(null, 'add', req.dbuser.id, dbsubmit.userId, dbsubmit.id, null, null, tostatus)
        }
      }
    }
    const msg = 'Submits updated: ' + countAtFromStatus + (countAtFromStatus ? '. No emails sent.' : '')
    utils.returnOK(req, res, msg)
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* POST: Edit or Delete publication */
router.post('/pubs/:pubid', async function (req, res, next) {
  if (req.headers['x-http-method-override'] === 'DELETE') {
    await deletePublication(req, res, next)
    return
  }
  if (!('x-http-method-override' in req.headers)) {
    await editPublication(req, res, next)
    return
  }
  return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST delete publication */
/* ACCESS: SUPER-ONLY TO TEST */
async function deletePublication (req, res, next) {
  // console.log('DELETE /pubs')
  try {
    if (!req.dbuser.super) return utils.giveup(req, res, 'Not a super')

    const pubid = parseInt(req.params.pubid)
    if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Cannot find pub ' + pubid)

    const ta = await sequelize.transaction()
    try {
      const dbpublookups = await dbpub.getPubLookups()
      for (const dbpublookup of dbpublookups) {
        await models.publookupvalues.destroy({ where: { publookupId: dbpublookup.id } }, { transaction: ta })
      }
      await models.publookups.destroy({ where: { pubId: pubid } }, { transaction: ta })

      const dbflows = await dbpub.getFlows()
      for (const dbflow of dbflows) {
        await models.flowacceptings.destroy({ where: { flowId: dbflow.id } }, { transaction: ta })
        await models.flowstatuses.destroy({ where: { flowId: dbflow.id } }, { transaction: ta })
      }
      await models.flows.destroy({ where: { pubId: pubid } }, { transaction: ta })

      await models.pubroles.destroy({ where: { pubId: pubid } }, { transaction: ta })

      await models.pubmailtemplates.destroy({ where: { pubId: pubid } }, { transaction: ta })

      await dbpub.destroy({ transaction: ta }) // Cascades to userpubs, pubuserroles
      await ta.commit()
      logger.log4req(req, 'DELETED publication', pubid)
    } catch (e) {
      await ta.rollback()
      return utils.giveup(req, res, e.message)
    }

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST edit publication: different calls:
 * - enabled
 * - addPubRoleOwner
 * - addroleid+addroleuserid
 * - pubname+pubdupusers
 * */
/* ACCESS: OWNER OR SUPER TO TEST */
async function editPublication (req, res, next) {
  // console.log('POST /pubs')
  try {
    const pubid = parseInt(req.params.pubid)
    if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
    req.dbpub = await models.pubs.findByPk(pubid)
    if (!req.dbpub) return utils.giveup(req, res, 'Cannot find pub ' + pubid)

    // TODO: Also allow owner to change enabled
    if (!req.dbuser.super) {
      // Set req.isowner, req.onlyanauthor and req.myroles for this publication
      if (!await dbutils.getMyRoles(req)) return utils.giveup(req, res, 'No access to this publication')
      if (!req.isowner) return utils.giveup(req, res, 'No access to this publication')
    }

    let somethingDone = false
    // ADMIN or SUPER: TOGGLE PUB ENABLED
    if ('enabled' in req.body) {
      if (typeof req.body.enabled !== 'boolean') return utils.giveup(req, res, 'enabled not boolean')
      req.dbpub.enabled = req.body.enabled
      await req.dbpub.save() // Transaction OK

      logger.log4req(req, 'Publication enabled toggled', pubid, req.body.enabled)
      somethingDone = true
    }
    if (req.dbuser.super) {
      // SUPER: ADD PUBROLE OWNER FOR PUB
      if ('addPubRoleOwner' in req.body) {
        if (typeof req.body.addPubRoleOwner !== 'boolean') return utils.giveup(req, res, 'addPubRoleOwner not boolean')
        if (!req.body.addPubRoleOwner) return utils.giveup(req, res, 'addPubRoleOwner not true')

        const dbsuperpubroles = await req.dbpub.getPubroles()
        for (const dbpubrole2 of dbsuperpubroles) {
          if (dbpubrole2.isowner) return utils.giveup(req, res, 'PubRoleOwner already present')
        }

        const newrole = {
          pubId: pubid,
          name: 'Owner',
          isowner: true,
          canviewall: false,
          defaultrole: false,
          isreviewer: false,
          userRequested: false,
          userDeniedAccess: false
        }
        const dbpubrole = await models.pubroles.create(newrole) // Transaction OK
        if (!dbpubrole) return utils.giveup(req, res, 'Could not create pubrole owner')

        logger.log4req(req, 'Publication role Owner created', pubid)
        somethingDone = true
      }
      // SUPER: ADD USER WITH ROLE IN PUB
      if ('addroleid' in req.body && 'addroleuserid' in req.body) {
        const addroleid = parseInt(req.body.addroleid)
        if (isNaN(addroleid)) return utils.giveup(req, res, 'Duff addroleid')

        const dbsuperpubroles = await req.dbpub.getPubroles()
        const dbpubrole = _.find(dbsuperpubroles, (pubrole) => { return pubrole.id === addroleid })
        if (!dbpubrole) return utils.giveup(req, res, 'pubrole not found')

        const userid = parseInt(req.body.addroleuserid)
        if (isNaN(userid)) return utils.giveup(req, res, 'Duff addroleuserid')

        const dbuser = await models.users.findByPk(userid)
        if (!dbuser) return utils.giveup(req, res, 'Cannot find user ' + userid)

        const dbexistingusers = await dbpubrole.getUsers()
        const isexistinguser = _.find(dbexistingusers, (user) => { return user.id === userid })
        if (isexistinguser) return utils.giveup(req, res, 'Already has that role')

        // Give user access to publication if need be
        const ispubuser = await req.dbpub.hasUser(dbuser)
        if (!ispubuser) await req.dbpub.addUser(dbuser)
        // Give user this role
        await dbpubrole.addUser(dbuser) // Transaction ???

        logger.log4req(req, 'Publication user added as ' + dbpubrole.name, userid)
        somethingDone = true
      }
      // SUPER: ADD USER WITH ROLE IN PUB
      if ('pubname' in req.body && 'pubdupusers' in req.body) {
        const dupok = await dupPublication(req, res, next)
        if (!dupok) return
        somethingDone = true
      }
    }
    if (!somethingDone) return utils.giveup(req, res, 'editPublication: invalid parameters')

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST edit publication: duplicate publication
 * */
/* ACCESS: OWNER OR SUPER TO TEST */
async function dupPublication (req, res, next) {
  const pubname = req.body.pubname.trim()
  if (pubname.length === 0) return utils.giveup(req, res, 'pubname empty')

  if (typeof req.body.pubdupusers !== 'boolean') return utils.giveup(req, res, 'pubdupusers not boolean')

  // See if the name exists already, case insensitive
  const matching = await models.pubs.findAll({
    where: {
      name: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'LIKE', pubname.toLowerCase())
    }
  })
  if (matching.length > 0) return utils.giveup(req, res, 'name already exists')

  const ta = await sequelize.transaction()

  try {
    const newpub = models.duplicate(models.pubs, req.dbpub)
    newpub.name = pubname
    newpub.title = pubname
    newpub.alias = req.site.url.split('.').reverse().join('.') // eg from 'papers.phdcc.com' to 'com.phdcc.papers'
    newpub.alias += '.' + pubname.toLowerCase().replace(/ /g, '-')
    // console.log('newpub', newpub)

    const dbnewpub = await models.pubs.create(newpub, { transaction: ta }) // Transaction DONE
    if (!dbnewpub) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate publication') }

    // Duplicate pubmailtemplates
    const dbmailtemplates = await req.dbpub.getMailTemplates()
    for (const dbmailtemplate of dbmailtemplates) {
      const newmailtemplate = models.duplicate(models.pubmailtemplates, dbmailtemplate)
      const dbnewmailtemplate = await dbnewpub.createMailTemplate(newmailtemplate, { transaction: ta }) // Transaction DONE
      if (!dbnewmailtemplate) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate mail template') }
      // TODO: add in new flowstageId, flowstatusId, flowgradeId, pubroleId
    }

    // Duplicate publookups and publookupvalues
    const dbpublookups = await req.dbpub.getPubLookups()
    for (const dbpublookup of dbpublookups) {
      const newpublookup = models.duplicate(models.publookups, dbpublookup)
      const dbnewpublookup = await dbnewpub.createPubLookup(newpublookup, { transaction: ta }) // Transaction DONE
      if (!dbnewpublookup) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate publookup') }

      const dbpublookupvalues = await dbpublookup.getPubLookupValues()
      for (const dbpublookupvalue of dbpublookupvalues) {
        const newpublookupvalue = models.duplicate(models.publookupvalues, dbpublookupvalue)
        const dbnewpublookupvalue = await dbnewpublookup.createPubLookupValue(newpublookupvalue, { transaction: ta }) // Transaction DONE
        if (!dbnewpublookupvalue) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate publookupvalue') }
      }      
    }

    // Duplicate flows
    const dbflows = await req.dbpub.getFlows()
    for (const dbflow of dbflows) {
      const newflow = models.duplicate(models.flows, dbflow)
      const dbnewflow = await dbnewpub.createFlow(newflow, { transaction: ta }) // Transaction DONE
      if (!dbnewflow) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate flow') }

      // Duplicate flowacceptings - TODO refs
      const dbflowacceptings = await dbflow.getFlowAcceptings()
      for (const dbflowaccepting of dbflowacceptings) {
        const newflowaccepting = models.duplicate(models.flowacceptings, dbflowaccepting)
        const dbnewflowaccepting = await dbnewflow.createFlowAccepting(newflowaccepting, { transaction: ta }) // Transaction DONE
        if (!dbnewflowaccepting) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate flowaccepting') }
      }
      // Duplicate flowstatuses - TODO refs
      const dbflowstatuses = await dbflow.getFlowStatuses()
      for (const dbflowstatus of dbflowstatuses) {
        const newflowstatus = models.duplicate(models.flowstatuses, dbflowstatus)
        const dbnewflowstatus = await dbnewflow.createFlowStatus(newflowstatus, { transaction: ta }) // Transaction DONE
        if (!dbnewflowstatus) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate flowstatus') }
      }
    }

    // Duplicate pubroles
    const dbsuperpubroles = await req.dbpub.getPubroles()
    for (const dbpubrole of dbsuperpubroles) {
      const newpubrole = models.duplicate(models.pubroles, dbpubrole)
      newpubrole.pubId = dbnewpub.id
      const dbnewpubrole = await models.pubroles.create(newpubrole, { transaction: ta }) // Transaction DONE
      if (!dbnewpubrole) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate pubrole') }
      if (req.body.pubdupusers) {
        // If copying users, duplicate pubrole users
        const dbpubroleusers = await dbpubrole.getUsers()
        for (const dbpubroleuser of dbpubroleusers) {
          const dbuser = await models.users.findByPk(dbpubroleuser.id)
          if (!dbuser) { await ta.rollback(); return utils.giveup(req, res, 'Cannot find user ' + dbpubroleuser.id) }
          await dbnewpubrole.addUser(dbuser, { transaction: ta }) // Transaction DONE
        }
      }
    }

    if (req.body.pubdupusers) {
      const dbpubusers = await req.dbpub.getUsers()
      for (const dbpubuser of dbpubusers) {
        await dbnewpub.addUser(dbpubuser, { transaction: ta }) // Transaction DONE
      }
    }

    await ta.commit()
    logger.log4req(req, 'Publication duplicated to ' + pubname)
  } catch (e) {
    await ta.rollback()
    return utils.giveup(req, res, e.message)
  }

  return true
}

module.exports = router
