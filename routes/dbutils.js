const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

/* ************************ */

getSubmitCurrentStatus = async function (req, dbsubmit, submit, flow) {
  if (!('onlyanauthor' in req)) throw new Error('onlyanauthor not in req')
  const dbstatuses = await dbsubmit.getStatuses({ order: [['id', 'DESC']] })
  submit.statuses = []
  req.currentstatus = false
  for (const dbstatus of dbstatuses) {
    const submitstatus = models.sanitise(models.submitstatuses, dbstatus)
    const flowstatus = _.find(flow.statuses, flowstatus => { return flowstatus.id === submitstatus.flowstatusId })
    if (req.onlyanauthor && !flowstatus.visibletoauthor) continue // If author: only return statuses with visibletoauthor
    submit.statuses.push(submitstatus)
    if (!req.currentstatus) req.currentstatus = submitstatus
  }
}

/* ************************ */

getSubmitFlowPub = async function (req, submitid) {
  if (submitid !== 0) {
    req.dbsubmit = await models.submits.findByPk(submitid)
  }
  if (!req.dbsubmit) return 'Cannot find submitid ' + submitid

  req.dbflow = await req.dbsubmit.getFlow()
  if (!req.dbflow) return 'No pub found for submitid ' + req.dbsubmit.id

  req.dbpub = await req.dbflow.getPub()
  if (!req.dbpub) return 'No pub found for submitid ' + req.dbsubmit.id

  // Get MY roles in all publications - see if isowner etc
  if (!await getMyRoles(req)) return 'No access to this publication'

  return false
}

/* ************************ */
/* getMyRoles
    returns false if not allowed access to publication
   Needs: req.dbuser, req.dbpub
*/
async function getMyRoles(req) {
  req.isowner = false
  req.isauthor = false
  req.onlyanauthor = false
  req.canviewall = false

  // Check user has access to publication
  const dbpubchecks = await req.dbuser.getPublications()
  const dbpubcheck = _.find(dbpubchecks, (dbpubcheck) => { return dbpubcheck.id === req.dbpub.id })
  if (!dbpubcheck) return false

  req.dbmypubroles = await req.dbuser.getRoles()
  req.myroles = []
  for (const dbmypubrole of req.dbmypubroles){
    if (dbmypubrole.pubId === req.dbpub.id) {
      const mypubrole = models.sanitise(models.pubroles, dbmypubrole)
      req.myroles.push(mypubrole)
      if (mypubrole.isowner) req.isowner = true
      if (mypubrole.canviewall) req.canviewall = true
      if (mypubrole.defaultrole) { // ie author
        req.onlyanauthor = true
        req.isauthor = true
      }
    }
  }
  if (req.myroles.length >= 2) req.onlyanauthor = false

  if (req.dbuser.super) {
    req.onlyanauthor = false
    req.isowner = true
  }
  return true
}

/* ************************ */
/*
 *  needs: req.currentstatus, req.myroles, req.pub
 *  return true if ihaveactions
 */
async function addActions(req, flow, submit) {
  let ihaveactions = false
  submit.actions = [] // Allowable actions
  if (req.currentstatus.flowstatusId) {
    const flowstatus = _.find(flow.statuses, (status) => { return status.id === req.currentstatus.flowstatusId })
    if (flowstatus) {
      if (flowstatus.cansubmitflowstageId) {
        const stage = _.find(flow.stages, (stage) => { return stage.id === flowstatus.cansubmitflowstageId })
        if (stage) {
          // Am I allowed to enter this stage
          const hasRole = _.find(req.myroles, (role) => { return role.id === stage.pubroleId })
          if (hasRole) {
            const route = '/panel/' + req.dbpub.id + '/' + flow.id + '/' + submit.id + '/add/' + flowstatus.cansubmitflowstageId
            submit.actions.push({ name: 'Add ' + stage.name, route, show: 3, dograde: 0 })
            ihaveactions = true
          }
        }
      }
    }
  }
  return ihaveactions
}
/* ************************ */

async function isActionableSubmit(req, flow, submit) {

  let includethissubmit = false

  req.iamgrading = false
  req.ihavegraded = false
  req.iamleadgrader = false

  // If user is the submitter, then include
  if (await req.dbuser.hasSubmit(req.dbsubmit)) {
    includethissubmit = true
  } // Don't else this

  if (req.isowner || req.canviewall) {
    includethissubmit = true
  }

  // Go through grades looking to see if currentstatus means that I need to grade
  for (const flowgrade of flow.flowgrades) {

    if (flowgrade.flowstatusId === req.currentstatus.flowstatusId) { // If we are at status where this grade possible

      // If I have already graded, don't add action later (but still show submit)
      let gradedid = false
      for (const dbsubmitgrading of req.dbsubmitgradings) {
        if ((flowgrade.id === dbsubmitgrading.flowgradeId) && (dbsubmitgrading.userId === req.dbuser.id)) {
          req.ihavegraded = true // (fake) comment this out to check if I can grade twice
          gradedid = dbsubmitgrading.id
        }
      }

      let route = false
      //console.log('flowgrade', submit.id, flowgrade.id, flowgrade.name, flowgrade.visibletorole, flowgrade.visibletoreviewers)
      if (flowgrade.visibletorole !== 0) {
        // Check if I have role that means I can grade
        const ihavethisrole = _.find(req.myroles, roles => { return roles.id === flowgrade.visibletorole })
        if (ihavethisrole) {
          includethissubmit = true
          req.iamgrading = true
          route = !req.ihavegraded
        }
      }
      if (flowgrade.visibletoreviewers) {
        // Check if I am reviewer that means I can grade
        const dbreviewers = await req.dbsubmit.getReviewers()
        for (const dbreviewer of dbreviewers) {
          if (dbreviewer.userId === req.dbuser.id) {
            includethissubmit = true
            req.iamgrading = true
            if (dbreviewer.lead) req.iamleadgrader = true
            route = !req.ihavegraded
          }
        }
      }
      if (route && submit) {
        const entrytograde = _.find(submit.entries, (entry) => { return entry.flowstageId === flowgrade.displayflowstageId })
        if (entrytograde) {
          route = '/panel/' + req.dbpub.id + '/' + flow.id + '/' + submit.id + '/' + entrytograde.id
          submit.actions.push({ name: flowgrade.name + ' needed', gradename: 'Add ' + flowgrade.name, route, flowgradeid: flowgrade.id, show: 3, dograde: 4 })
          submit.user = 'author redacted'
        }
      }
      if (req.ihavegraded && submit) {
        submit.actionsdone.push({ id: gradedid, name: flowgrade.name+' added'})
      }
    }
  }
  return includethissubmit
}

/* ************************ */

async function getFlowWithFlowgrades(dbflow) {
  const flow = models.sanitise(models.flows, dbflow)

  // Get all grades for this flow
  const dbflowgrades = await dbflow.getFlowgrades()
  flow.flowgrades = []
  for (const dbflowgrade of dbflowgrades) {
    const flowgrade = models.sanitise(models.flowgrades, dbflowgrade)
    flowgrade.scores = models.sanitiselist(await dbflowgrade.getFlowgradescores(), models.flowgradescores)
    flow.flowgrades.push(flowgrade)
  }
  return flow
}

/* ************************ */
/* Retrive formfields for entry
 * entry may be existing or newly created
 */
async function getEntryFormFields(entry, flowstageId) {
  const dbformfields = await models.formfields.findAll({
    where: {
      formtypeid: flowstageId
    },
    order: [
      ['weight', 'ASC']
    ]
  })
  entry.fields = models.sanitiselist(dbformfields, models.formfields)
  //????entry.publookups = []
  entry.pubrolelookups = []
  for (const dbformfield of dbformfields) {
    if (dbformfield.pubroleId != null) {
      const dbpubrole = await models.pubroles.findByPk(dbformfield.pubroleId)
      if (!dbpubrole) {
        console.log('formfield: pubroleId not found', pubroleId)
      } else {
        const dbusers = await dbpubrole.getUsers()
        const users = []
        for (const dbuser of dbusers) {
          users.push({ value: dbuser.id, text: dbuser.name })
        }
        entry.pubrolelookups.push({
          pubroleId: dbformfield.pubroleId,
          users
        })
      }
    }
  }
}

/* ************************ */

module.exports = {
  getSubmitCurrentStatus,
  getSubmitFlowPub,
  getMyRoles,
  addActions,
  isActionableSubmit,
  getFlowWithFlowgrades,
  getEntryFormFields,
}
