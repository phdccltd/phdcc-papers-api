const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

/* ************************ */

getSubmitCurrentStatus = async function (dbsubmit, submit, flow, onlyanauthor) {
  const dbstatuses = await dbsubmit.getStatuses({ order: [['id', 'DESC']] })
  submit.statuses = []
  let currentstatus = false
  for (const dbstatus of dbstatuses) {
    const submitstatus = models.sanitise(models.submitstatuses, dbstatus)
    const flowstatus = _.find(flow.statuses, flowstatus => { return flowstatus.id === submitstatus.flowstatusId })
    if (onlyanauthor && !flowstatus.visibletoauthor) continue // If author: only return statuses with visibletoauthor
    submit.statuses.push(submitstatus)
    if (!currentstatus) currentstatus = submitstatus
  }
  return currentstatus
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
  req.dbmypubroles = await req.dbuser.getRoles()
  req.iamowner = _.find(req.dbmypubroles, mypubrole => { return mypubrole.pubId === req.dbpub.id && mypubrole.isowner })

  return false
}

/* ************************ */

module.exports = {
  getSubmitCurrentStatus,
  getSubmitFlowPub,
}
