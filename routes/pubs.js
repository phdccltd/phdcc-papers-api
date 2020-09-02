const { Router } = require('express')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')

const router = Router()

/* GET pubs listing. */
router.get('/pubs', async function (req, res, next) {
  console.log('GET /pubs')

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
      // TODO: CHECK ACCESS RIGHTS???
      dbpubs = await req.dbuser.getPublications(order)
    }

    // Get my roles in all publications
    const dbmypubroles = await req.dbuser.getRoles()

    // Sanitise and get associated publookups/publookupvalues
    const pubs = []
    for (const dbpub of dbpubs) {
      const pub = models.sanitise(models.pubs, dbpub)

      // Set isowner and myroles for this publication
      pub.isowner = false
      pub.myroles = []
      _.forEach(dbmypubroles, (dbmypubrole) => {
        if (dbmypubrole.pubId === pub.id) {
          const mypubrole = models.sanitise(models.pubroles, dbmypubrole)
          pub.myroles.push(mypubrole)
          if (mypubrole.isowner) pub.isowner = true
        }
      })

      pub.pubroles = []
      const dbpubroles = await dbpub.getPubroles()
      for (const dbpubrole of dbpubroles) {
        const pubrole = models.sanitise(models.pubroles, dbpubrole)
        pub.pubroles.push(pubrole)
      }

      pub.publookups = []
      const dbpublookups = await dbpub.getPubLookups()
      for (const dbpublookup of dbpublookups) {
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
        pub.publookups.push(publookup)
      }
      pubs.push(pub)
    }
    utils.returnOK(req, res, pubs, 'pubs')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})


/* GET pub by ID. */
/* NO NEED!
router.get('/pubs/:id', async function (req, res, next) {
  // TODO: Check access - is user allowed to access this publication?
  const id = parseInt(req.params.id)
  console.log('GET /pubs', id)
  const dbpub = await models.pubs.findByPk(id)
  if (dbpub) {
    const pub = models.sanitise(models.pubs, dbpub)
    utils.returnOK(req, res, pub, 'pub')
  } else {
    utils.giveup(req, res, 'Invalid pubs:id')
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
