const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

/* ************************ */

getSubmitCurrentStatus = async function (req, dbsubmit, submit, flow, onlyanauthor) {
  const dbstatuses = await dbsubmit.getStatuses({ order: [['id', 'DESC']] })
  submit.statuses = []
  req.currentstatus = false
  for (const dbstatus of dbstatuses) {
    const submitstatus = models.sanitise(models.submitstatuses, dbstatus)
    const flowstatus = _.find(flow.statuses, flowstatus => { return flowstatus.id === submitstatus.flowstatusId })
    if (onlyanauthor && !flowstatus.visibletoauthor) continue // If author: only return statuses with visibletoauthor
    submit.statuses.push(submitstatus)
    if (!req.currentstatus) req.currentstatus = submitstatus
  }
}

/* ************************ */

getSubmitFlowPub = async function (req, submitid) {
  req.dbsubmit = await models.submits.findByPk(submitid)
  if (!req.dbsubmit) return 'Cannot find submitid ' + submitid

  req.dbflow = await req.dbsubmit.getFlow()
  if (!req.dbflow) return 'No pub found for submitid ' + submitid

  req.dbpub = await req.dbflow.getPub()
  if (!req.dbpub) return 'No pub found for submitid ' + submitid

  // Get MY roles in all publications - see if iamowner
  await getMyRoles(req)
  //req.dbmypubroles = await req.dbuser.getRoles()
  //req.iamowner = _.find(req.dbmypubroles, mypubrole => { return mypubrole.pubId === req.dbpub.id && mypubrole.isowner })

  return false
}

/* ************************ */

async function getMyRoles(req) {
  req.isowner = false
  req.onlyanauthor = false

  req.dbmypubroles = await req.dbuser.getRoles()
  req.myroles = []
  for (const dbmypubrole of req.dbmypubroles){
    if (dbmypubrole.pubId === req.dbpub.id) {
      const mypubrole = models.sanitise(models.pubroles, dbmypubrole)
      req.myroles.push(mypubrole)
      if (mypubrole.isowner) req.isowner = true
      if (mypubrole.defaultrole) req.onlyanauthor = true // ie author
    }
  }
  if (req.myroles.length >= 2) req.onlyanauthor = false
  else if (req.myroles.length === 0) req.onlyanauthor = true
  if (req.dbuser.super) {
    req.onlyanauthor = false
    req.isowner = true
  }
}

/* ************************ */

async function isActionableSubmit(req, flow, submit) {

  let includethissubmit = false // ARGHH DUPLICATE CODE: SIMILAR SUB SLIMMED DOWN

  req.iamgrading = false

  // If user is the submitter, then include // XXXXXXXXX CHECK
  if (await req.dbuser.hasSubmit(req.dbsubmit)) {
    includethissubmit = true
  } // Don't else this


  // Go through grades looking to see if currentstatus means that I need to grade
  for (const flowgrade of flow.flowgrades) {

    // If I have already graded, don't add action later (but still show submit)
    let ihavegraded = false
    for (const dbsubmitgrading of req.dbsubmitgradings) {
      if ((flowgrade.id === dbsubmitgrading.flowgradeId) && (dbsubmitgrading.userId === req.dbuser.id)) {
        //ihavegraded = true // (fake) comment this out to check if I can grade twice
      }
    }

    if (flowgrade.flowstatusId === req.currentstatus.flowstatusId) { // If we are at status where this grade possible
      let route = false
      //console.log('flowgrade', submit.id, flowgrade.id, flowgrade.name, flowgrade.visibletorole, flowgrade.visibletoreviewers)
      if (flowgrade.visibletorole !== 0) {
        // Check if I have role that means I can grade
        const ihavethisrole = _.find(req.myroles, roles => { return roles.id === flowgrade.visibletorole })
        if (ihavethisrole) {
          includethissubmit = true
          req.iamgrading = true
          route = !ihavegraded
        }
      }
      if (flowgrade.visibletoreviewers) {
        // Check if I am reviewer that means I can grade
        const dbreviewers = await req.dbsubmit.getReviewers()
        for (const dbreviewer of dbreviewers) {
          if (dbreviewer.userId === req.dbuser.id) {
            includethissubmit = true
            req.iamgrading = true
            route = !ihavegraded
          }
        }
      }
      if (route && submit) {
        const entrytograde = _.find(submit.entries, (entry) => { return entry.flowstageId === flowgrade.displayflowstageId })
        if (entrytograde) {
          route = '/panel/' + req.dbpub.id + '/' + flow.id + '/' + submit.id + '/' + entrytograde.id
          submit.actions.push({ name: flowgrade.name, route, flowgradeid: flowgrade.id })
          submit.user = 'author redacted'
        }
      }
    }
  }
  return includethissubmit
}

/* ************************ */

module.exports = {
  getSubmitCurrentStatus,
  getSubmitFlowPub,
  getMyRoles,
  isActionableSubmit,
}
