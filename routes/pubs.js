const { Router } = require('express')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')

const router = Router()

/* GET pubs listing. */
router.get('/pubs', async function (req, res, next) {
  //console.log('GET /pubs')

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

      pub.pubroles = models.sanitiselist(await dbpub.getPubroles(), models.pubroles)

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
      pubs.push(pub)
    }
    utils.returnOK(req, res, pubs, 'pubs')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})


module.exports = router
