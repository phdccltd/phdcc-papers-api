const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')

const router = Router()

/* GET submits for publication. */
router.get('/submits/:pubid', async function (req, res, next) {
  console.log('GET /submits')

  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /submits', pubid)

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Invalid pubs:id')

    const dbflows = await dbpub.getFlows()
    const flows = []
    for (const dbflow of dbflows) {
      const flow = models.sanitise(models.flows, dbflow)
      console.log('flow', flow.name)
      flow.submits = []
      const dbsubmits = await dbflow.getSubmits()
      for (const dbsubmit of dbsubmits) {
        console.log('submit', dbsubmit.name)
        flow.submits.push(models.sanitise(models.submits, dbsubmit))
      }
      console.log('flow=', flow)
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
