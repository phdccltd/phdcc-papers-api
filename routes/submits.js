const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')

const router = Router()

/* GET entry and associated formfields */
router.get('/submits/entry/:entryid', async function (req, res, next) {
  try {
    const entryid = parseInt(req.params.entryid)
    console.log('GET /submits/entry/', entryid, req.user.id)

    if (!Number.isInteger(req.user.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const dbentry = await models.entries.findByPk(entryid)
    if (!dbentry) return utils.giveup(req, res, 'Invalid entryid')

    const dbsubmit = await models.submits.findByPk(dbentry.submitId)
    if (!dbsubmit) return utils.giveup(req, res, 'No submit for entryid')

    if (dbsubmit.userId !== req.user.id) return utils.giveup(req, res, 'Not your submit entry')


    const entry = models.sanitise(models.entries, dbentry)
    
    const dbentryvalues = await dbentry.getEntryValues()
    entry.values = []
    for (const dbentryvalue of dbentryvalues) {
      const entryvalue = models.sanitise(models.entryvalues, dbentryvalue)
      entry.values.push(entryvalue)
    }

    const dbformfields = await models.formfields.findAll({
      where: {
        formtypeid: dbentry.flowstageId
      },
      order: [
        ['weight', 'ASC']
      ]
    })
    entry.fields = []
    entry.publookups = []
    for (const dbformfield of dbformfields) {
      const formfield = models.sanitise(models.formfields, dbformfield)
      entry.fields.push(formfield)
      if (dbformfield.publookupId) {
        const publookup = entry.publookups.find(pl => pl.id === dbformfield.publookupId)
        if (!publookup) {
          const dbpublookup = await models.publookups.findByPk(dbformfield.publookupId)
          if (!dbpublookup) return utils.giveup(req, res, 'Duff dbformfield.publookupId found' + dbformfield.publookupId)
          const publookup = models.sanitise(models.publookups, dbpublookup)
          const dbpublookupvalues = await dbpublookup.getPubLookupValues({
            order: [
              ['weight', 'ASC']
            ]
          })
          publookup.values = []
          for (const dbpublookupvalue of dbpublookupvalues) {
            const publookupvalue = models.sanitise(models.publookupvalues, dbpublookupvalue)
            publookup.values.push(publookupvalue)
          }
          entry.publookups.push(publookup)
        }
      }
    }

    //console.log('entry', entry)
    utils.returnOK(req, res, entry, 'entry')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* GET formfields for specified flowstageId*/
router.get('/submits/formfields/:flowstageId', async function (req, res, next) {
  try {
    const flowstageId = parseInt(req.params.flowstageId)
    console.log('GET /submits/formfields/', flowstageId, req.user.id)

    if (!Number.isInteger(req.user.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const entry = {}
    const dbformfields = await models.formfields.findAll({
      where: {
        formtypeid: flowstageId
      },
      order: [
        ['weight', 'ASC']
      ]
    })
    entry.fields = []
    entry.publookups = []
    for (const dbformfield of dbformfields) {
      const formfield = models.sanitise(models.formfields, dbformfield)
      entry.fields.push(formfield)
      if (dbformfield.publookupId) {
        const publookup = entry.publookups.find(pl => pl.id === dbformfield.publookupId)
        if (!publookup) {
          const dbpublookup = await models.publookups.findByPk(dbformfield.publookupId)
          if (!dbpublookup) return utils.giveup(req, res, 'Duff dbformfield.publookupId found' + dbformfield.publookupId)
          const publookup = models.sanitise(models.publookups, dbpublookup)
          const dbpublookupvalues = await dbpublookup.getPubLookupValues({
            order: [
              ['weight', 'ASC']
            ]
          })
          publookup.values = []
          for (const dbpublookupvalue of dbpublookupvalues) {
            const publookupvalue = models.sanitise(models.publookupvalues, dbpublookupvalue)
            publookup.values.push(publookupvalue)
          }
          entry.publookups.push(publookup)
        }
      }
    }

    //console.log('entry', entry)
    utils.returnOK(req, res, entry, 'entry')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* GET submits for publication. */
router.get('/submits/pub/:pubid', async function (req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /submits/pub/', pubid, req.user.id)

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
