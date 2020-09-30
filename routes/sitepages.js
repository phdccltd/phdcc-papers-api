const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')

const router = Router()

/* GET sitepages */
router.get('/sitepages', async function (req, res, next) {
  try {
    const dbsite = await models.sites.findByPk(req.site.id)
    const dbsitepages = await dbsite.getSitePages()
    const sitepages = []
    for (const dbsitepage of dbsitepages) {
      sitepages.push(models.sanitise(models.sitepages, dbsitepage))
    }
    //console.log(sitepages)

    utils.returnOK(req, res, sitepages, 'sitepages')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

module.exports = router
