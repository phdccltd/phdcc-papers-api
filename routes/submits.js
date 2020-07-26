const _ = require('lodash/core')
const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')

const router = Router()

/* GET submits for publication. */
router.get('/submits/:pubid', async function (req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /submits', pubid, req.user.id)

    if (!Number.isInteger(req.user.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Invalid pubs:id')

    const dbflows = await dbpub.getFlows()
    const flows = []
    for (const dbflow of dbflows) {
      const flow = models.sanitise(models.flows, dbflow)
      //console.log('flow', flow.name)
      flow.submits = []
      const dbsubmits = await dbflow.getSubmits({
        where: {
          userId: req.user.id
        }
      })
      flow.statuses = []
      const dbstatuses = await dbflow.getFlowStatuses()
      for (const dbstatus of dbstatuses) {
        //console.log('dbstatus', dbstatus.status)
        flow.statuses.push(models.sanitise(models.flowstatuses, dbstatus))
      }
      flow.acceptings = []
      const dbacceptings = await dbflow.getFlowAcceptings()
      for (const dbaccepting of dbacceptings) {
        //console.log('dbaccepting', dbaccepting.open)
        flow.acceptings.push(models.sanitise(models.flowacceptings, dbaccepting))
      }
      flow.stages = []
      const dbstages = await dbflow.getFlowStages({
        order: [
          ['weight', 'ASC']
        ]
      })
      for (const dbstage of dbstages) {
        //console.log('dbstage', dbstage.open)
        flow.stages.push(models.sanitise(models.flowstages, dbstage))
      }
      for (const dbsubmit of dbsubmits) {
        const submit = models.sanitise(models.submits, dbsubmit)
        const dbentries = await dbsubmit.getEntries({
          include: { model: models.flowstages },
          order: [
            [models.flowstages, 'weight', 'ASC'],
          ]
        })
        submit.entries = []
        for (const dbentry of dbentries) {
          submit.entries.push(models.sanitise(models.entries, dbentry))
        }

        const dbstatuses = await dbsubmit.getStatuses({
          order: [
            ['id', 'ASC']
          ]
        })
        submit.statuses = []
        for (const dbstatus of dbstatuses) {
          submit.statuses.push(models.sanitise(models.submitstatuses, dbstatus))
        }

        flow.submits.push(submit)
      }
      //console.log('flow=', flow)
      flows.push(flow)
    }

    utils.returnOK(req, res, flows, 'flows')
/*    const order = {
      order: [
        ['startdate', 'ASC']
      ]
    }
    let dbsubmits = false
    if (req.user.super) {
      dbsubmits = await models.submits.findAll(order)
    } else {
      // TODO: CHECK ACCESS RIGHTS???
      pub.getFlows
      const dbpubs = await req.user.getPublications(order)
    }

    const submits = []
    for (const dbsubmit of dbsubmits) {
      submits.push(models.sanitise(models.submits, dbsubmit))
    }
    utils.returnOK(req, res, submits, 'submits')*/
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})


/* GET submit by ID. 
router.get('/submits/:id', async function (req, res, next) {
  // TODO: Check access - is user allowed to access this submission?
  const id = parseInt(req.params.id)
  console.log('GET /submits', id)
  const dbsubmit = await models.submits.findByPk(id)
  if (dbsubmit) {
    const submit = models.sanitise(models.submits, dbsubmit)
    utils.returnOK(req, res, submit, 'submit')
  } else {
    utils.giveup(req, res, 'Invalid submits:id')
  }
})*/

/*
app.get('/', (req, res) => {
  return res.send('Received a GET HTTP method');
});

app.post('/', (req, res) => {
  return res.send('Received a POST HTTP method');
});

app.put('/', (req, res) => {
  return res.send('Received a PUT HTTP method');
});

app.delete('/', (req, res) => {
  return res.send('Received a DELETE HTTP method');
});
*/

module.exports = router
