const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

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


module.exports = {
  getSubmitCurrentStatus,
}
