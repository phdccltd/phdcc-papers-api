const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

const router = Router()

const TMPDIR = '/tmp/papers/'

/* ************************ */
/* GET: Get anonymised gradings */
/* ACCESS: OWNER-ONLY NOT TESTED */
router.get('/downloads/anon/:pubid', async function (req, res, next) {
  const pubid = parseInt(req.params.pubid)
  const flowgradeid = parseInt(req.query.flowgradeid)
  console.log('GET /downloads/anon', pubid, flowgradeid)
  try {
    req.dbpub = await models.pubs.findByPk(pubid)
    if (!req.dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    if (!await dbutils.getMyRoles(req)) return 'No access to this publication'

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    fs.mkdirSync(TMPDIR, { recursive: true })

    const saveFilename = "anonymised.txt"

    const sometext = "hello\rthere"
    
    const outpath = path.join(TMPDIR, saveFilename)
    const writeGeoJson = new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(outpath)
      stream.on('close', function (fd) {
        resolve()
      })
      stream.on('open', function (fd) {
        stream.write(sometext)
        stream.end()
      })
    })
    console.log('start writeGeoJson')
    await writeGeoJson
    console.log('done writeGeoJson')

    //header("Content-Disposition: attachment; filename=$zip_filename");
    const ContentType = mime.lookup(outpath)
    var options = {
      root: TMPDIR,
      dotfiles: 'deny',
      headers: {
        'Content-Type': ContentType,
        'Content-Disposition': 'attachment; filename="' + saveFilename + '"',
        'Access-Control-Expose-Headers': 'Content-Disposition',
      }
    }
    res.sendFile(saveFilename, options)

  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

module.exports = router
