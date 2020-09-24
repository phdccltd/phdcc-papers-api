// Zip files made using https://www.archiverjs.com/

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
    sendFile(res, saveFilename)

    // Delete tmp file after send
    setTimeout(() => { deleteTempFiles(outpath, false) }, 1000)
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* GET: Get anonymised summary for publication */
/* ACCESS: OWNER-ONLY NOT TESTED */
router.get('/downloads/summary/:pubid', async function (req, res, next) {
  const pubid = parseInt(req.params.pubid)
  const flowstageid = parseInt(req.query.flowstageid)
  console.log('GET /downloads/summary', pubid, flowstageid)
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

    ////////////////

    const now = new Date()
    const nowstring = now.toISOString().substring(0, 16).replace(/:/g, "-")
    const dirName = 'summary-' + nowstring
    fs.mkdirSync(TMPDIR + dirName, { recursive: true })
    fs.mkdirSync(TMPDIR + dirName + '/papers', { recursive: true })

    ////////
    const flowstageFilename = dbflowstage.name.replace(/\s/g, "-") + nowstring + '.csv'
    console.log('flowstageFilename', flowstageFilename)
    const flowstageStream = await createFile(TMPDIR + dirName + '/' + flowstageFilename)
    console.log('flowstageStream opened')
    flowstageStream.write('Scrufulopus\rnow\r\r')
    await closeFile(flowstageStream)
    console.log('flowstageStream closed')

    const dbsubmits = await dbflow.getSubmits()
    for (const dbsubmit of dbsubmits) {
      console.log('Submit: ', dbsubmit.id)
    }

    const wf1Stream = await createFile(TMPDIR + dirName + '/papers/hello.txt')
    wf1Stream.write('Hello\rthere\r\r')
    await closeFile(wf1Stream)

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


    // Make zip file from directory
    const saveFilename = await makeZipOfDirectory(dirName)
    const outpath = path.join(TMPDIR, saveFilename)

    // Send Zip file
    sendFile(res, saveFilename)

    // Delete tmp file and directory 1 second after send
    setTimeout(() => { deleteTempFiles(outpath, dirName) }, 1000)
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
function createFile(path) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(path)
    stream.on('open', async function (fd) {
      resolve(stream)
    })
  })
}
/* ************************ */
function closeFile(stream) {
  return new Promise((resolve, reject) => {
    stream.on('close', function (fd) {
      resolve()
    })
    stream.end()
  })
}

/* ************************ */
function sendFile(res, saveFilename) {
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
}

/* ************************ */
function deleteTempFiles(outpath, dirName) {
  fs.unlink(outpath, err => { if (err) console.log(err) })
  if (dirName) {
    deleteFolderRecursivelySync(TMPDIR + dirName)
  }
}

/* ************************ */
async function makeZipOfDirectory(dirName) {

  const saveFilename = dirName + '.zip'

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
        console.log('archive warning warning', err)
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

    // Add all files in directory to ZIP, recurseively
    archive.directory(TMPDIR + dirName, false)

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
    archive.finalize()
  })
  await saveSummaryZip

  return saveFilename
}

/* ************************ */

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

/* ************************ */

module.exports = router
