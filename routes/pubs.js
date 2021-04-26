const { Router } = require('express')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

const router = Router()

/* GET pubs listing. */
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
    console.log('alias', alias)

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
router.post('/pubs/:pubid', async function (req, res, next) {
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

module.exports = router
