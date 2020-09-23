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
  const flowstageid = parseInt(req.query.flowstageid)
  console.log('GET /downloads/anon', pubid, flowstageid)
  try {
    req.dbpub = await models.pubs.findByPk(pubid)
    if (!req.dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    if (!await dbutils.getMyRoles(req)) return 'No access to this publication'

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const dbflowstage = await models.flowstages.findByPk(flowstageid)
    if (!dbflowstage) return utils.giveup(req, res, 'Cannot find dbflowstage')

    const dbflow = await dbflowstage.getFlow()
    if (!dbflow) return utils.giveup(req, res, 'Cannot find dbflow')
    
    const dbpubcheck = await dbflow.getPub()
    if (!dbpubcheck) return utils.giveup(req, res, 'Cannot find dbpubcheck')
    if (dbpubcheck.id !== req.dbpub.id) return utils.giveup(req, res, 'dbpubcheck.id and dbpub.id mismatch')

    fs.mkdirSync(TMPDIR, { recursive: true })

    const now = new Date()
    const saveFilename = dbflowstage.name.replace(/\s/g, "-") + '-' + now.toISOString().substring(0, 16).replace(/:/g, "-") + '.txt'

    const outpath = path.join(TMPDIR, saveFilename)
    const writeAnon = new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(outpath)
      stream.on('close', function (fd) {
        resolve()
      })
      stream.on('open', async function (fd) {

        const dbentries = await dbflowstage.getEntries()
        for (const dbentry of dbentries) {
          const dbsubmit = await dbentry.getSubmit()
          if (!dbsubmit) continue

          stream.write('---------------------------------------------------\r')
          stream.write('Paper no: ' + dbsubmit.id+'\r')
          stream.write('Title: ' + dbsubmit.name + '\r')

          const entry = {}
          await dbutils.getEntryFormFields(entry, flowstageid)

          entry.values = []
          for (const dbentryvalue of await dbentry.getEntryValues()) {
            const entryvalue = models.sanitise(models.entryvalues, dbentryvalue)
            const field = _.find(entry.fields, field => { return field.id === entryvalue.formfieldId })
            if (field.hidewhengrading) continue
            let value = ''
            switch (field.type){
              case 'string':
              case 'phone':
              case 'email':
                value = entryvalue.string
                break
              case 'text':
                value = entryvalue.text
                break
              case 'lookups': 
                value = entryvalue.string
                break
              case 'yes':
              case 'yesno':
                value = entryvalue.integer?'Yes':'No'
                break
              case 'file':
                value = path.basename(entryvalue.file)
                break
              case 'rolelookups':
                break
            }
            stream.write(field.label + '\r' + value + '\r\r')
          }
        }

        stream.end()
      })
    })
    await writeAnon

    // Send file
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

    // Delete tmp file after send
    setTimeout(() => { fs.unlink(outpath, err => { if (err) console.log(err) }) }, 1000)
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

module.exports = router
