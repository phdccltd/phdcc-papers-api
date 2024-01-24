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

    const dbpubrolemessages = await models.pubrolemessages.findAll()
    for (const dbpubrolemessage of dbpubrolemessages) {
      const aroleids = dbpubrolemessage.roleids.split(',')
      dbpubrolemessage.roleids = []
      for (const aroleid of aroleids) {
        dbpubrolemessage.roleids.push(parseInt(aroleid))
      }
    }

    // Sanitise and get associated publookups/publookupvalues
    const pubs = []
    for (const dbpub of dbpubs) {
      const pub = models.sanitise(models.pubs, dbpub)
      pub.apiversion = process.env.version // Bit naff
      delete pub.email

      // Set isowner, myroles and pubrolemessages for this publication
      pub.isowner = false
      pub.myroles = []
      pub.pubrolemessages = []
      for (const dbmypubrole of dbmypubroles) {
        if (dbmypubrole.pubId === pub.id) {
          const mypubrole = models.sanitise(models.pubroles, dbmypubrole)
          pub.myroles.push(mypubrole)
          if (mypubrole.isowner) pub.isowner = true
          for (const dbpubrolemessage of dbpubrolemessages) {
            for (const roleid of dbpubrolemessage.roleids) {
              if (roleid === dbmypubrole.id) {
                pub.pubrolemessages.push(dbpubrolemessage.text)
              }
            }
          }
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
      await models.pubmailtemplates.destroy({ where: { pubId: pubid } }, { transaction: ta })

      const dbflows = await dbpub.getFlows()
      for (const dbflow of dbflows) {
        const dbflowgrades = await dbflow.getFlowgrades()
        for (const dbflowgrade of dbflowgrades) {
          await models.flowgradescores.destroy({ where: { flowgradeId: dbflowgrade.id } }, { transaction: ta })
        }

        await models.flowgrades.destroy({ where: { flowId: dbflow.id } }, { transaction: ta })
        await models.flowacceptings.destroy({ where: { flowId: dbflow.id } }, { transaction: ta })
        await models.flowstatuses.destroy({ where: { flowId: dbflow.id } }, { transaction: ta })

        const dbflowstages = await dbflow.getFlowStages()
        for (const dbflowstage of dbflowstages) {
          await models.formfields.destroy({ where: { formtypeid: dbflowstage.id } }, { transaction: ta })
        }
        await models.flowstages.destroy({ where: { flowId: dbflow.id } }, { transaction: ta })
      }
      await models.flows.destroy({ where: { pubId: pubid } }, { transaction: ta })

      const dbpublookups = await dbpub.getPubLookups()
      for (const dbpublookup of dbpublookups) {
        await models.publookupvalues.destroy({ where: { publookupId: dbpublookup.id } }, { transaction: ta })
      }
      await models.publookups.destroy({ where: { pubId: pubid } }, { transaction: ta })

      await models.pubroles.destroy({ where: { pubId: pubid } }, { transaction: ta })

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

      dbpublookup.newid = dbnewpublookup.id
    }

    // Duplicate pubroles
    const dbpubroles = await req.dbpub.getPubroles()
    for (const dbpubrole of dbpubroles) {
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
      dbpubrole.newid = dbnewpubrole.id
    }

    // Duplicate pubmailtemplates
    const dbmailtemplates = await req.dbpub.getMailTemplates()
    for (const dbmailtemplate of dbmailtemplates) {
      const newmailtemplate = models.duplicate(models.pubmailtemplates, dbmailtemplate)

      if (newmailtemplate.pubroleId) {
        const dboldpubrole = _.find(dbpubroles, (pr) => { return pr.id === newmailtemplate.pubroleId })
        if (!dboldpubrole) { await ta.rollback(); return utils.giveup(req, res, 'Could not find pubrole referenced in mail template') }
        newmailtemplate.pubroleId = dboldpubrole.newid
      }
      if (newmailtemplate.sendOnRoleGiven) {
        const dboldpubrole = _.find(dbpubroles, (pr) => { return pr.id === newmailtemplate.sendOnRoleGiven })
        if (!dboldpubrole) { await ta.rollback(); return utils.giveup(req, res, 'Could not find sendOnRoleGiven referenced in mail template') }
        newmailtemplate.sendOnRoleGiven = dboldpubrole.newid
      }

      // update these later:
      //  * flowstageId, flowstatusId, flowgradeId
      //  * body tokens eg {{entry.field_1}} etc

      const dbnewmailtemplate = await dbnewpub.createMailTemplate(newmailtemplate, { transaction: ta }) // Transaction DONE
      if (!dbnewmailtemplate) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate mail template') }
      dbmailtemplate.newid = dbnewmailtemplate.id
    }

    const formfieldchanges = []
    const formfieldhideatgradings = []

    // Duplicate flows
    const dbflows = await req.dbpub.getFlows()
    for (const dbflow of dbflows) {
      const newflow = models.duplicate(models.flows, dbflow)
      const dbnewflow = await dbnewpub.createFlow(newflow, { transaction: ta }) // Transaction DONE
      if (!dbnewflow) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate flow') }

      // Duplicate flowstages
      const dbflowstages = await dbflow.getFlowStages()
      for (const dbflowstage of dbflowstages) {
        const newflowstage = models.duplicate(models.flowstages, dbflowstage)

        if (dbflowstage.pubroleId) {
          const dboldpubrole = _.find(dbpubroles, (pr) => { return pr.id === dbflowstage.pubroleId })
          if (!dboldpubrole) { await ta.rollback(); return utils.giveup(req, res, 'Could not find pubrole referenced in flowstage') }
          newflowstage.pubroleId = dboldpubrole.newid
        }
        if (dbflowstage.rolecanadd) {
          const dboldpubrole = _.find(dbpubroles, (pr) => { return pr.id === dbflowstage.rolecanadd })
          if (!dboldpubrole) { await ta.rollback(); return utils.giveup(req, res, 'Could not find pubrole referenced in flowstage') }
          newflowstage.rolecanadd = dboldpubrole.newid
        }

        const dbnewflowstage = await dbnewflow.createFlowStage(newflowstage, { transaction: ta }) // Transaction DONE
        if (!dbnewflowstage) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate flowstage') }
        dbflowstage.newid = dbnewflowstage.id

        const dbformfields = await models.formfields.findAll({ where: { formtypeid: dbflowstage.id } })
        for (const dbformfield of dbformfields) {
          const newformfield = models.duplicate(models.formfields, dbformfield)
          newformfield.formtypeid = dbnewflowstage.id

          if (dbformfield.publookupId) {
            const dboldpublookup = _.find(dbpublookups, (pl) => { return pl.id === dbformfield.publookupId })
            if (!dboldpublookup) { await ta.rollback(); return utils.giveup(req, res, 'Could not find publookup referenced in formfield') }
            newformfield.publookupId = dboldpublookup.newid
          }
          if (dbformfield.pubroleId) {
            const dboldpubrole = _.find(dbpubroles, (pr) => { return pr.id === dbformfield.pubroleId })
            if (!dboldpubrole) { await ta.rollback(); return utils.giveup(req, res, 'Could not find pubrole referenced in formfield') }
            newformfield.pubroleId = dboldpubrole.newid
          }

          const dbnewformfield = await models.formfields.create(newformfield, { transaction: ta }) // Transaction DONE
          if (!dbnewformfield) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate formfield') }
          dbformfield.newid = dbnewformfield.id
          formfieldchanges.push([dbformfield.id, dbnewformfield.id])

          if (dbformfield.hideatgrading) {
            formfieldhideatgradings.push(dbnewformfield)
          }
        }
        for (const dbformfield of dbformfields) { // Go through again for requiredif
          if (dbformfield.requiredif) {
            const dbnewformfield = await models.formfields.findByPk(dbformfield.newid, { transaction: ta })
            if (!dbnewformfield) { await ta.rollback(); return utils.giveup(req, res, 'Could not find duplicated formfield for requiredif') }

            const eqpos = dbformfield.requiredif.indexOf('=')
            if (eqpos === -1) { await ta.rollback(); return utils.giveup(req, res, 'Badly formatted requiredif') }
            const refdid = parseInt(dbformfield.requiredif.substring(0, eqpos))
            const dbrefdff = _.find(dbformfields, (fs) => { return fs.id === refdid })
            if (!dbrefdff) { await ta.rollback(); return utils.giveup(req, res, 'Could not find refdid for requiredif') }
            dbnewformfield.requiredif = dbrefdff.newid + dbformfield.requiredif.substring(eqpos)
            dbnewformfield.save({ transaction: ta }) // Transaction DONE
          }
        }

        // Update any flowstage references in mailtemplates
        for (const dbmailtemplate of dbmailtemplates) {
          if (dbmailtemplate.flowstageId && (dbmailtemplate.flowstageId === dbflowstage.id)) {
            const dbnewpubmailtemplate = await models.pubmailtemplates.findByPk(dbmailtemplate.newid, { transaction: ta })
            if (!dbnewpubmailtemplate) { await ta.rollback(); return utils.giveup(req, res, 'Could not find refd mailtemplate') }
            dbnewpubmailtemplate.flowstageId = dbflowstage.newid
            dbnewpubmailtemplate.save({ transaction: ta }) // Transaction DONE
          }
        }
      }

      // Duplicate flowstatuses
      const dbflowstatuses = await dbflow.getFlowStatuses()
      for (const dbflowstatus of dbflowstatuses) {
        const newflowstatus = models.duplicate(models.flowstatuses, dbflowstatus)

        if (newflowstatus.submittedflowstageId) {
          const dboldstage = _.find(dbflowstages, (fs) => { return fs.id === newflowstatus.submittedflowstageId })
          if (!dboldstage) { await ta.rollback(); return utils.giveup(req, res, 'Could not find submitted stage referenced in flowstatus') }
          newflowstatus.submittedflowstageId = dboldstage.newid
        }
        if (newflowstatus.cansubmitflowstageId) {
          const dboldstage = _.find(dbflowstages, (fs) => { return fs.id === newflowstatus.cansubmitflowstageId })
          if (!dboldstage) { await ta.rollback(); return utils.giveup(req, res, 'Could not find cansubmit stage referenced in flowstatus') }
          newflowstatus.cansubmitflowstageId = dboldstage.newid
        }

        const dbnewflowstatus = await dbnewflow.createFlowStatus(newflowstatus, { transaction: ta }) // Transaction DONE
        if (!dbnewflowstatus) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate flowstatus') }
        dbflowstatus.newid = dbnewflowstatus.id

        // Update any flowstatusId references in mailtemplates
        for (const dbmailtemplate of dbmailtemplates) {
          if (dbmailtemplate.flowstatusId && (dbmailtemplate.flowstatusId === dbflowstatus.id)) {
            const dbnewpubmailtemplate = await models.pubmailtemplates.findByPk(dbmailtemplate.newid, { transaction: ta })
            if (!dbnewpubmailtemplate) { await ta.rollback(); return utils.giveup(req, res, 'Could not find refd mailtemplate') }
            dbnewpubmailtemplate.flowstatusId = dbflowstatus.newid
            dbnewpubmailtemplate.save({ transaction: ta }) // Transaction DONE
          }
        }
      }

      // Duplicate flowgrades
      const dbflowgrades = await dbflow.getFlowgrades()
      for (const dbflowgrade of dbflowgrades) {
        const newflowgrade = models.duplicate(models.flowgrades, dbflowgrade)

        if (newflowgrade.flowstatusId) {
          const dboldstatus = _.find(dbflowstatuses, (fs) => { return fs.id === newflowgrade.flowstatusId })
          if (!dboldstatus) { await ta.rollback(); return utils.giveup(req, res, 'Could not find status referenced in flowgrade') }
          newflowgrade.flowstatusId = dboldstatus.newid
        }
        if (newflowgrade.displayflowstageId) {
          const dboldstage = _.find(dbflowstages, (fs) => { return fs.id === newflowgrade.displayflowstageId })
          if (!dboldstage) { await ta.rollback(); return utils.giveup(req, res, 'Could not find display stage referenced in flowgrade') }
          newflowgrade.displayflowstageId = dboldstage.newid
        }
        if (newflowgrade.visibletorole) {
          const dboldpubrole = _.find(dbpubroles, (pr) => { return pr.id === newflowgrade.visibletorole })
          if (!dboldpubrole) { await ta.rollback(); return utils.giveup(req, res, 'Could not find visibletorole referenced in flowgrade') }
          newflowgrade.visibletorole = dboldpubrole.newid
        }
        if (newflowgrade.authorcanseeatthesestatuses) {
          const newcanseeats = []
          const canseeats = newflowgrade.authorcanseeatthesestatuses.split(',')
          for (const canseeat of canseeats) {
            const dboldstatus = _.find(dbflowstatuses, (fs) => { return fs.id === parseInt(canseeat) })
            if (!dboldstatus) { await ta.rollback(); return utils.giveup(req, res, 'Could not find authorcanseeatstatus referenced in flowgrade') }
            newcanseeats.push(dboldstatus.newid)
          }
          newflowgrade.authorcanseeatthesestatuses = newcanseeats.join()
        }

        const dbnewflowgrade = await dbnewflow.createFlowgrade(newflowgrade, { transaction: ta }) // Transaction DONE
        if (!dbnewflowgrade) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate flowgrade') }
        dbflowgrade.newid = dbnewflowgrade.id

        const dbflowgradescores = await dbflowgrade.getFlowgradescores()
        for (const dbflowgradescore of dbflowgradescores) {
          const newflowgradescore = models.duplicate(models.flowgradescores, dbflowgradescore)
          const dbnewflowgradescore = await dbnewflowgrade.createFlowgradescore(newflowgradescore, { transaction: ta }) // Transaction DONE
          if (!dbnewflowgradescore) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate flowgradescore') }
        }

        // Update any flowgradeId references in mailtemplates
        for (const dbmailtemplate of dbmailtemplates) {
          if (dbmailtemplate.flowgradeId && (dbmailtemplate.flowgradeId === dbflowgrade.id)) {
            const dbnewpubmailtemplate = await models.pubmailtemplates.findByPk(dbmailtemplate.newid, { transaction: ta })
            if (!dbnewpubmailtemplate) { await ta.rollback(); return utils.giveup(req, res, 'Could not find refd mailtemplate') }
            dbnewpubmailtemplate.flowgradeId = dbflowgrade.newid
            dbnewpubmailtemplate.save({ transaction: ta }) // Transaction DONE
          }
        }

        // Update any hideatgrading references in new formfields
        for (const newformfield of formfieldhideatgradings) {
          if (newformfield.hideatgrading === dbflowgrade.id) {
            const dbnewformfield = await models.formfields.findByPk(newformfield.id, { transaction: ta })
            if (!dbnewformfield) { await ta.rollback(); return utils.giveup(req, res, 'Could not find refd hideatgrading formfield') }
            dbnewformfield.hideatgrading = dbflowgrade.newid
            dbnewformfield.save({ transaction: ta }) // Transaction DONE
          }
        }
      }

      // Duplicate flowacceptings
      const dbflowacceptings = await dbflow.getFlowAcceptings()
      for (const dbflowaccepting of dbflowacceptings) {
        const newflowaccepting = models.duplicate(models.flowacceptings, dbflowaccepting)
        if (newflowaccepting.flowstageId) {
          const dboldstage = _.find(dbflowstages, (fs) => { return fs.id === newflowaccepting.flowstageId })
          if (!dboldstage) { await ta.rollback(); return utils.giveup(req, res, 'Could not find stage referenced in flowaccepting') }
          newflowaccepting.flowstageId = dboldstage.newid
        }
        if (newflowaccepting.flowstatusId) {
          const dboldstatus = _.find(dbflowstatuses, (fs) => { return fs.id === newflowaccepting.flowstatusId })
          if (!dboldstatus) { await ta.rollback(); return utils.giveup(req, res, 'Could not find status referenced in flowaccepting') }
          newflowaccepting.flowstatusId = dboldstatus.newid
        }
        const dbnewflowaccepting = await dbnewflow.createFlowAccepting(newflowaccepting, { transaction: ta }) // Transaction DONE
        if (!dbnewflowaccepting) { await ta.rollback(); return utils.giveup(req, res, 'Could not create duplicate flowaccepting') }
      }
    }

    // Go through mailtemplates again to update entry.field tokens
    for (const dbmailtemplate of dbmailtemplates) {
      const tokenstart = '{{entry.field_'
      const tokenstartlength = tokenstart.length
      let body = dbmailtemplate.body
      let bodychanged = false
      let tokenpos = 0
      while (true) {
        tokenpos = body.indexOf(tokenstart, tokenpos)
        if (tokenpos === -1) break
        tokenpos += tokenstartlength
        const endtoken = body.indexOf('}}', tokenpos)
        if (endtoken !== -1) {
          const fieldno = parseInt(body.substring(tokenpos, endtoken))
          const formfieldchange = _.find(formfieldchanges, (ffc) => { return ffc[0] === fieldno })
          if (!formfieldchange) { await ta.rollback(); return utils.giveup(req, res, 'Could not find mailtemplate token entry_field_' + fieldno) }
          body = body.substring(0, tokenpos) + formfieldchange[1] + body.substring(endtoken)
          bodychanged = true
        }
      }
      if (bodychanged) {
        const dbnewpubmailtemplate = await models.pubmailtemplates.findByPk(dbmailtemplate.newid, { transaction: ta })
        if (!dbnewpubmailtemplate) { await ta.rollback(); return utils.giveup(req, res, 'Could not find refd mailtemplate') }
        dbnewpubmailtemplate.body = body
        dbnewpubmailtemplate.save({ transaction: ta }) // Transaction DONE
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
