const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')

const router = Router()

/* ************************ */
/* POST: Add/Edit or Delete site page */
router.post('/sitepages', async function (req, res, next) {
  // console.log('/sitepages', req.headers['x-http-method-override'])
  if (req.headers['x-http-method-override'] === 'DELETE') {
    await deleteSitePage(req, res, next)
    return
  }
  if (!('x-http-method-override' in req.headers)) {
    await addEditSitePage(req, res, next)
    return
  }
  return utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST add/edit site page */
/* ACCESS: SUPER-ONLY TESTED */
async function deleteSitePage (req, res, next) {
  // console.log('DELETE /sitepages')
  try {
    if (!req.dbuser.super) return utils.giveup(req, res, 'Not a super')

    const pageid = parseInt(req.body.pageid)
    if (isNaN(pageid)) return utils.giveup(req, res, 'Duff pageid')
    const dbsitepage = await models.sitepages.findByPk(pageid)
    if (!dbsitepage) return utils.giveup(req, res, 'Cannot find sitepage ' + pageid)

    await dbsitepage.destroy() // Transaction OK

    logger.log4req(req, 'DELETED sitepage', pageid)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST add/edit site page */
/* ACCESS: SUPER-ONLY TESTED */
async function addEditSitePage (req, res, next) {
  // console.log('POST /sitepages')
  try {
    if (!req.dbuser.super) return utils.giveup(req, res, 'Not a super')

    const pageid = 'pageid' in req.body ? parseInt(req.body.pageid) : 0
    if (isNaN(pageid)) return utils.giveup(req, res, 'Duff pageid')
    if (!('pagepath' in req.body)) return utils.giveup(req, res, 'pagepath missing')
    const pagepath = req.body.pagepath.trim()
    if (pagepath.length === 0) return utils.giveup(req, res, 'pagepath empty')
    if (!('pagetitle' in req.body)) return utils.giveup(req, res, 'pagetitle missing')
    const pagetitle = req.body.pagetitle.trim()
    if (pagetitle.length === 0) return utils.giveup(req, res, 'pagetitle empty')
    if (!('pagecontent' in req.body)) return utils.giveup(req, res, 'pagecontent missing')
    const pagecontent = req.body.pagecontent.trim()
    if (pagecontent.length === 0) return utils.giveup(req, res, 'pagecontent empty')

    let ok = false
    if (pageid) {
      const dbsitepage = await models.sitepages.findByPk(pageid)
      if (!dbsitepage) return utils.giveup(req, res, 'Cannot find site page ' + pageid)
      if (dbsitepage.siteId !== req.site.id) return utils.giveup(req, res, 'siteId mismatch')

      dbsitepage.path = pagepath
      dbsitepage.title = pagetitle
      dbsitepage.content = pagecontent
      await dbsitepage.save() // Transaction OK
      logger.log4req(req, 'UPDATED sitepage', pageid)
      ok = true
    } else {
      const params = {
        siteId: req.site.id,
        path: pagepath,
        title: pagetitle,
        content: pagecontent
      }
      const dbsitepage = await models.sitepages.create(params) // Transaction OK
      if (!dbsitepage) return utils.giveup(req, res, 'site page not created')
      logger.log4req(req, 'CREATED new sitepage', dbsitepage.id)
      ok = true
    }

    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

module.exports = router
