const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const Sequelize = require('sequelize')
const _ = require('lodash/core')
const archiver = require('archiver')
const models = require('../models')
const utils = require('../utils')
const logger = require('../logger')
const dbutils = require('./dbutils')

const router = Router()

const TMPDIR = '/tmp/papers/'

/* ************************ */
/* GET: Get anonymised stage entries */
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
            const formfield = _.find(entry.fields, field => { return field.id === entryvalue.formfieldId })
            if (formfield.hidewhengrading) continue
            const stringvalue = await dbutils.getEntryStringValue(entryvalue, formfield)
            stream.write(formfield.label + '\r' + stringvalue + '\r\r')
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

/* ************************ */
/* GET: Get anonymised summary for publication */
/* ACCESS: OWNER-ONLY NOT TESTED */
router.get('/downloads/summary/:pubid', async function (req, res, next) {
  const pubid = parseInt(req.params.pubid)
  console.log('GET /downloads/summary', pubid)
  try {
    // https://www.archiverjs.com/

    const now = new Date()
    const dirName = 'summary-' + now.toISOString().substring(0, 16).replace(/:/g, "-")
    fs.mkdirSync(TMPDIR + dirName, { recursive: true })
    fs.mkdirSync(TMPDIR + dirName+'/papers', { recursive: true })

    const writeFile1 = new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(TMPDIR + dirName +'/papers/hello.txt')
      stream.on('close', function (fd) {
        resolve()
      })
      stream.on('open', async function (fd) {
        stream.write('Hello\rthere\r\r')
        stream.end()
      })
    })
    await writeFile1
    const writeFile2 = new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(TMPDIR + dirName + '/there.txt')
      stream.on('close', function (fd) {
        resolve()
      })
      stream.on('open', async function (fd) {
        stream.write('Well\rnow\r\r')
        stream.end()
      })
    })
    await writeFile2


    const saveFilename = dirName + '.zip'

    const outpath = path.join(TMPDIR, saveFilename)

    const saveSummaryZip = new Promise((resolve, reject) => {
      const output = fs.createWriteStream(TMPDIR + saveFilename)
      const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
      })

      output.on('close', function () { // archive.pointer() has byte count
        resolve()
      })

      // good practice to catch warnings (ie stat failures and other non-blocking errors)
      archive.on('warning', function (err) {
        if (err.code === 'ENOENT') {
          console.log('archive warning warning',err)
        } else {
          console.log('archive warning error', err)
          throw err
        }
      })

      // good practice to catch this error explicitly
      archive.on('error', function (err) {
        console.log('archive error', err)
        reject()
      })

      // pipe archive data to the file
      archive.pipe(output)

      // append a file from stream
      //const file1 = __dirname + '/file1.txt'
      //archive.append(fs.createReadStream(file1), { name: 'file1.txt' })

      // append a file from string
      archive.append('tough tammy', { name: 'file1.txt' })
      archive.append('string cheese!', { name: 'file2.txt' })

      archive.directory(TMPDIR + dirName, false)
      
      // finalize the archive (ie we are done appending files but streams have to finish yet)
      // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
      archive.finalize()
    })
    await saveSummaryZip

    const ContentType = mime.lookup(saveFilename)
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

    // Delete tmp file 1 second after send
    setTimeout(() => {
      fs.unlink(outpath, err => { if (err) console.log(err) })

      try {
        deleteFolderRecursivelySync(TMPDIR+dirName)
      } catch (err) {
        console.log(err);
      }



    }, 1000)
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

function deleteFolderRecursivelySync(dirpath) {
  const files = fs.readdirSync(dirpath)
  files.forEach(file => {
    const path = dirpath + '/' + file
    if (fs.lstatSync(path).isDirectory()) {
      deleteFolderRecursivelySync(path)
    } else {
      fs.unlinkSync(path)
    }
  })
  fs.rmdirSync(dirpath)
}

module.exports = router
