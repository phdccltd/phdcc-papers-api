const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')

const router = Router()

/* GET sitepages */
router.get('/sitepages', async function (req, res, next) {
  try {
    const sitedb = await models.sites.findByPk(req.site.id)
    const sitepagesdb = await sitedb.getSitePages()
    sitepages = []
    for (const sitepagedb of sitepagesdb) {
      sitepages.push(models.sanitise(models.sitepages, sitepagedb))
    }
    //console.log(sitepages)

    utils.returnOK(req, res, sitepages, 'sitepages')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

module.exports = router
