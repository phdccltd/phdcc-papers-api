// Zip files made using https://www.archiverjs.com/

const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const _ = require('lodash/core')
const archiver = require('archiver')
const models = require('../models')
const utils = require('../utils')
const dbutils = require('./dbutils')

const router = Router()

const TMPDIR = process.env.TESTTMPDIR ? process.env.TESTTMPDIR : '/tmp/papers/'

/* ************************ */
/* GET: Get anonymised stage entries */
/* ACCESS: OWNER-ONLY TESTED */
router.get('/downloads/anon/:pubid', downloadAnonymousStage)

async function downloadAnonymousStage (req, res, next) {
  const pubid = parseInt(req.params.pubid)
  const flowstageid = parseInt(req.query.flowstageid)
  console.log('GET /downloads/anon', pubid, flowstageid)
  if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
  if (isNaN(flowstageid)) return utils.giveup(req, res, 'Duff flowstageid')
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

    /// ///////

    const now = new Date()
    const saveFilename = dbflowstage.name.replace(/\s/g, '-') + '-' + now.toISOString().substring(0, 16).replace(/:/g, '-') + '.txt'

    const outpath = path.join(TMPDIR, saveFilename)
    const anonStream = await openFile(outpath)
    anonStream.write('\ufeff')

    /// ///////

    const dbentries = await dbflowstage.getEntries()
    for (const dbentry of dbentries) {
      const dbsubmit = await dbentry.getSubmit()
      if (!dbsubmit) continue

      anonStream.write('---------------------------------------------------\r')
      anonStream.write('Paper no: ' + dbsubmit.id + '\r')
      anonStream.write('Title: ' + dbsubmit.name + '\r')

      const entry = {}
      await dbutils.getEntryFormFields(entry, flowstageid)
      await writeAnonEntryValues(entry.fields, dbentry, anonStream)
    }
    await closeFile(anonStream)

    /// ///////
    // Send file
    sendFile(res, saveFilename)

    // Delete tmp file after send
    if (!process.env.TESTING) {
      setTimeout(() => { deleteTempFiles(outpath, false) }, 1000)
    }
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* GET: Get summary and all for publication */
/* ACCESS: OWNER-ONLY TESTED */
router.get('/downloads/summary/:pubid', async (req, res, next) => { await downloadFull(req, res, next, false) })

router.get('/downloads/all/:pubid', async (req, res, next) => { await downloadFull(req, res, next, true) })

async function downloadFull (req, res, next, all) {
  let filesdir = req.site.privatesettings.files // eg /var/sites/papersdevfiles NO FINAL SLASH
  if (process.env.TESTFILESDIR) filesdir = process.env.TESTFILESDIR

  const pubid = parseInt(req.params.pubid)
  const flowstageid = parseInt(req.query.flowstageid)
  console.log('GET downloads ', pubid, flowstageid)
  if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
  if (isNaN(flowstageid)) return utils.giveup(req, res, 'Duff flowstageid')
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

    /// /////////////

    const flowstagefilename = dbflowstage.name.replace(/\s/g, '-') + '.txt'

    const entry = {}
    await dbutils.getEntryFormFields(entry, flowstageid)

    const now = new Date()
    const nowstring = now.toISOString().substring(0, 16).replace(/:/g, '-')

    const flow = {}
    const dbstatuses = await dbflow.getFlowStatuses({ order: [['weight', 'ASC']] })
    flow.statuses = models.sanitiselist(dbstatuses, models.flowstatuses)

    const dbflowgrades = await dbflow.getFlowgrades({ where: { displayflowstageId: flowstageid } })
    if (dbflowgrades.length !== 1) return utils.giveup(req, res, 'dbpubcheck.id and dbpub.id mismatch')
    const dbflowgrade = dbflowgrades[0]

    const flowgradename = dbflowgrade.name.replace(/\s/g, '-') + '-'
    // const dirName = 'summary-' + flowgradename + nowstring
    const dirName = (all ? 'all-' : 'summary-') + nowstring
    fs.mkdirSync(TMPDIR + dirName, { recursive: true })
    fs.mkdirSync(TMPDIR + dirName + '/papers', { recursive: true })

    // Paper id, Status, Title, Accept, Reject, Conflict-of-interest, Insufficient background, WillReview, WillReviewers, Comments
    const summaryHeader = ['Paper id', 'Status', 'Title']
    const dbflowgradescores = await dbflowgrade.getFlowgradescores()
    for (const dbflowgradescore of dbflowgradescores) {
      summaryHeader.push(dbflowgradescore.name)
    }
    if (dbflowgrade.canopttoreview) summaryHeader.push('WillReview')
    if (dbflowgrade.cancomment) summaryHeader.push('Comment')

    const flowgradeFilename = flowgradename + nowstring + '.csv'
    const flowgradeStream = await openFile(TMPDIR + dirName + '/' + flowgradeFilename)
    flowgradeStream.write('\ufeff')

    writeCSVline(flowgradeStream, summaryHeader)

    const dbsubmits = await dbflow.getSubmits()
    for (const dbsubmit of dbsubmits) {
      const paperdir = TMPDIR + dirName + '/papers/' + dbsubmit.id
      fs.mkdirSync(paperdir, { recursive: true })

      const _outpath = path.join(paperdir, flowstagefilename)
      const anonStream = await openFile(_outpath)
      anonStream.write('Paper no: ' + dbsubmit.id + '\r')
      anonStream.write('Title: ' + dbsubmit.name + '\r')

      const dbentries1 = await dbsubmit.getEntries({ where: { flowstageId: flowstageid } }) // Only returns one
      for (const dbentry of dbentries1) {
        await writeAnonEntryValues(entry.fields, dbentry, anonStream)
      }
      await closeFile(anonStream)

      const req2 = { onlyanauthor: false }
      const submit = { ismine: false }
      await dbutils.getSubmitCurrentStatus(req2, dbsubmit, submit, flow)

      let status = 'UNKNOWN'
      if (req2.currentstatus) {
        const flowstatus = _.find(flow.statuses, _flowstatus => { return _flowstatus.id === req2.currentstatus.flowstatusId })
        if (flowstatus) status = flowstatus.status
      }

      // Zero counts for this submit
      for (const dbflowgradescore of await dbflowgradescores) {
        dbflowgradescore.count = 0
      }

      // Go through gradings, counting scores
      let willreview = ''
      let comments = ''
      const dbsubmitgradings = await dbsubmit.getGradings()
      for (const dbsubmitgrading of dbsubmitgradings) {
        if (dbsubmitgrading.flowgradeId !== dbflowgrade.displayflowstageId) continue

        for (const dbflowgradescore of dbflowgradescores) {
          if (dbsubmitgrading.flowgradescoreId === dbflowgradescore.id) {
            dbflowgradescore.count++
          }
        }
        if (dbsubmitgrading.canreview) {
          const dbuser = await models.users.findByPk(dbsubmitgrading.userId)
          if (dbuser) {
            if (willreview.length > 0) willreview += ','
            willreview += dbuser.username
          }
        }
        if (dbsubmitgrading.comment.length > 0) {
          if (comments.length > 0) comments += ' | '
          comments += dbsubmitgrading.comment
        }
      }

      const flowgradeLine = [dbsubmit.id, status, dbsubmit.name]
      for (const dbflowgradescore of dbflowgradescores) {
        flowgradeLine.push(dbflowgradescore.count)
      }
      if (dbflowgrade.canopttoreview) flowgradeLine.push(willreview)
      if (dbflowgrade.cancomment) flowgradeLine.push(comments)

      writeCSVline(flowgradeStream, flowgradeLine)
    }
    await closeFile(flowgradeStream)

    /// //////////////////
    // FIND ALL SUBMISSIONS FOR THIS PUBLICATION

    const submissionsFilename = 'submissions-' + nowstring + '.csv'
    const submissionsStream = await openFile(TMPDIR + dirName + '/' + submissionsFilename)
    submissionsStream.write('\ufeff')

    const subcols = []
    subcols.push({ id: -15, formtypeid: 0, weight: -15, name: 'Paper id' })
    subcols.push({ id: -14, formtypeid: 0, weight: -14, name: 'Submitter' })
    subcols.push({ id: -13, formtypeid: 0, weight: -13, name: 'Type' })
    subcols.push({ id: -12, formtypeid: 0, weight: -12, name: 'Status' })
    subcols.push({ id: -11, formtypeid: 0, weight: -11, name: 'Title' })
    let nextfreesubcolid = -10

    const subrows = []
    const stagesfound = []

    for (const dbflow2 of await req.dbpub.getFlows()) {
      const flow2 = models.sanitise(models.flows, dbflow2)
      const dbstatuses2 = await dbflow.getFlowStatuses({ order: [['weight', 'ASC']] })
      flow2.statuses = models.sanitiselist(dbstatuses2, models.flowstatuses)

      const dbflowfields2 = []
      for (const dbstage of await dbflow2.getFlowStages()) {
        const stageformfields = await models.formfields.findAll({ where: { formtypeid: dbstage.id } })
        dbflowfields2.push(...stageformfields)
      }

      const dbsubmits2 = await dbflow2.getSubmits()
      for (const dbsubmit of dbsubmits2) {
        const row = {}
        row.cols = []
        subrows.push(row)

        const req2 = { onlyanauthor: false }
        const submit = { ismine: false }
        await dbutils.getSubmitCurrentStatus(req2, dbsubmit, submit, flow2)

        let status = 'UNKNOWN'
        if (req2.currentstatus) {
          const flowstatus = _.find(flow.statuses, _flowstatus => { return _flowstatus.id === req2.currentstatus.flowstatusId })
          if (flowstatus) status = flowstatus.status
        }

        const dbauthor = await models.users.findByPk(dbsubmit.userId)
        const authorusername = dbauthor ? dbauthor.username : 'UNKNOWN'

        row.cols.push({ id: -15, value: dbsubmit.id })
        row.cols.push({ id: -14, value: authorusername })
        row.cols.push({ id: -13, value: dbflow.name })
        row.cols.push({ id: -12, value: status })
        row.cols.push({ id: -11, value: dbsubmit.name })

        const dbentries = await dbsubmit.getEntries({ order: [['id', 'ASC']] })
        for (const dbentry of dbentries) {
          const dbflowstage2 = await dbentry.getFlowstage()
          let foundstage = _.find(stagesfound, _stage => { return _stage.id === dbflowstage2.id })
          if (!foundstage) {
            foundstage = { id: dbflowstage2.id }
            foundstage.colid = nextfreesubcolid++
            subcols.push({ id: foundstage.colid, formtypeid: 0, weight: foundstage.colid, name: dbflowstage2.name + ' date' })
            stagesfound.push(foundstage)
          }
          row.cols.push({ id: foundstage.colid, value: dbentry.dt.toISOString() })

          for (const dbentryvalue of await dbentry.getEntryValues()) {
            const entryvalue = models.sanitise(models.entryvalues, dbentryvalue)
            const formfield = _.find(dbflowfields2, field => { return field.id === entryvalue.formfieldId })
            if (formfield) {
              // if (!formfield.includeindownload) continue
              let stringvalue = ''
              if (formfield.includeindownload === 2) {
                stringvalue = (entryvalue.integer === 1) ? dbentry.dt.toISOString() : 'No'
              } else {
                stringvalue = await dbutils.getEntryStringValue(entryvalue, formfield)
              }
              const hcol = _.find(subcols, (h) => { return h.id === formfield.id })
              if (!hcol) subcols.push({ id: formfield.id, formtypeid: formfield.formtypeid, weight: formfield.weight, name: formfield.label })
              row.cols.push({ id: formfield.id, value: stringvalue })

              if (all && entryvalue.file && formfield.type === 'file') { // /1/2/2/78/175/Evening sunshine.docx
                const entrydir = TMPDIR + dirName + '/papers/' + dbsubmit.id + '/' + dbentry.id
                const filepath = path.join(filesdir, entryvalue.file)
                if (fs.existsSync(filepath)) {
                  const topath = path.join(entrydir, path.basename(filepath))
                  fs.mkdirSync(entrydir, { recursive: true })
                  fs.copyFileSync(filepath, topath)
                } // else console.log('FILE NOT FOUND')
              }
            }
            // else console.log('field not found', entryvalue.id)
          }
        }
      }
    }

    subcols.sort((a, b) => {
      if (a.formtypeid === b.formtypeid) return a.weight - b.weight
      return a.formtypeid - b.formtypeid
    })
    const submissionsHeader = []
    for (const col of subcols) {
      submissionsHeader.push(col.name)
    }
    writeCSVline(submissionsStream, submissionsHeader)

    for (const row of subrows) {
      const submissionsLine = []
      for (const col of subcols) {
        const v = _.find(row.cols, (o) => { return o.id === col.id })
        const sv = v ? v.value : ''
        submissionsLine.push(sv)
      }
      writeCSVline(submissionsStream, submissionsLine)
    }
    await closeFile(submissionsStream)

    // Make zip file from directory
    const saveFilename = await makeZipOfDirectory(dirName)
    const outpath = path.join(TMPDIR, saveFilename)

    // Send Zip file
    sendFile(res, saveFilename) // Might eventually need to send in chunks?

    // Delete tmp file and directory 1 second after send
    if (!process.env.TESTING) {
      setTimeout(() => { deleteTempFiles(outpath, dirName) }, 1000)
    }
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
function openFile (_path) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(_path)
    stream.on('open', async function (fd) {
      resolve(stream)
    })
  })
}
/* ************************ */
function closeFile (stream) {
  return new Promise((resolve, reject) => {
    stream.on('close', function (fd) {
      resolve()
    })
    stream.end()
  })
}

/* ************************ */
function writeCSVline (stream, items) {
  let line = ''
  for (const item of items) {
    if (typeof item !== 'undefined' && item !== null) {
      let escaped = item.toString()
      escaped = escaped.replace(/"/g, '""')
      escaped = escaped.replace(/\r/g, ' ')
      escaped = escaped.replace(/\n/g, ' ')
      line += '"' + escaped + '"'
    }
    line += ','
  }
  line += '\r'
  stream.write(line)
}

/* ************************ */
function sendFile (res, saveFilename) {
  const ContentType = mime.lookup(saveFilename)
  const options = {
    root: TMPDIR,
    dotfiles: 'deny',
    headers: {
      'Content-Type': ContentType,
      'Content-Disposition': 'attachment; filename="' + saveFilename + '"',
      'Access-Control-Expose-Headers': 'Content-Disposition'
    }
  }
  res.sendFile(saveFilename, options)
}

/* ************************ */
function deleteTempFiles (outpath, dirName) {
  fs.unlink(outpath, err => { if (err) console.log(err) })
  if (dirName) {
    deleteFolderRecursivelySync(TMPDIR + dirName)
  }
}

/* ************************ */
async function makeZipOfDirectory (dirName) {
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
      reject(new Error('Create archive failed'))
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
/* GET: Get reviewer performance for publication */
/* ACCESS: OWNER-ONLY TESTED */
router.get('/downloads/reviewers/:pubid', downloadReviewerPerformance)

async function downloadReviewerPerformance (req, res, next) {
  const pubid = parseInt(req.params.pubid)
  const sflowgradeids = req.query.flowgradeids
  console.log('GET review performance ', pubid, sflowgradeids)
  if (isNaN(pubid)) return utils.giveup(req, res, 'Duff pubid')
  if (!sflowgradeids) return utils.giveup(req, res, 'Missing flowgradeids')
  try {
    req.dbpub = await models.pubs.findByPk(pubid)
    if (!req.dbpub) return utils.giveup(req, res, 'Cannot find pubid ' + pubid)

    if (!await dbutils.getMyRoles(req)) return 'No access to this publication'

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const summaryHeader = ['Paper id', 'Type', 'Reviewer']

    const aflowgradeids = sflowgradeids.split(',')
    const dbflowgrades = []
    for (const sflowgradeid of aflowgradeids) {
      const flowgradeid = parseInt(sflowgradeid)
      if (isNaN(flowgradeid)) return utils.giveup(req, res, 'Duff flowgradeids', sflowgradeids)
      const dbflowgrade = await models.flowgrades.findByPk(flowgradeid)
      if (!dbflowgrade) return utils.giveup(req, res, 'Cannot find dbflowgrade')

      const dbflowstage = await models.flowstages.findByPk(dbflowgrade.displayflowstageId)
      if (!dbflowstage) return utils.giveup(req, res, 'Cannot find dbflowstage')
      dbflowgrade.flowstagename = dbflowstage.name

      const dbflow = await dbflowgrade.getFlow()
      if (!dbflow) return utils.giveup(req, res, 'Cannot find dbflow')

      const dbpubcheck = await dbflow.getPub()
      if (!dbpubcheck) return utils.giveup(req, res, 'Cannot find dbpubcheck')
      if (dbpubcheck.id !== req.dbpub.id) return utils.giveup(req, res, 'dbpubcheck.id and dbpub.id mismatch')

      const gradename = dbflowgrade.name
      summaryHeader.push(gradename + ' sent')
      summaryHeader.push(gradename + ' reviewed')
      summaryHeader.push(gradename + ' duration')
      summaryHeader.push(gradename + ' length')

      dbflowgrade.flowgradescores = await dbflowgrade.getFlowgradescores()

      const dbsentpubmailtemplate = await models.pubmailtemplates.findOne({ where: { flowstatusId: dbflowgrade.flowstatusId } })
      dbflowgrade.sentpubmailtemplateId = dbsentpubmailtemplate ? dbsentpubmailtemplate.id : 0

      dbflowgrades.push(dbflowgrade)
    }

    fs.mkdirSync(TMPDIR, { recursive: true })

    const now = new Date()
    const saveFilename = 'reviewers-' + now.toISOString().substring(0, 16).replace(/:/g, '-') + '.csv'

    const outpath = path.join(TMPDIR, saveFilename)
    const outStream = await openFile(outpath)
    outStream.write('\ufeff')

    writeCSVline(outStream, summaryHeader)

    for (const dbflow of await req.dbpub.getFlows()) {
      // Are we looking for any grades in this flow?
      let wearelooking = false
      const flowsgrades = await dbflow.getFlowgrades()
      for (const flowsgrade of flowsgrades) {
        const weare = _.find(dbflowgrades, (grade) => { return grade.id === flowsgrade.id })
        if (weare) {
          wearelooking = true
          break
        }
      }
      if (!wearelooking) continue

      const dbsubmits = await dbflow.getSubmits()
      for (const dbsubmit of dbsubmits) {
        // console.log('SUBMIT', dbsubmit.id)
        const dbgradings = await dbsubmit.getGradings()

        const submitactionlogs = await models.actionlogs.findAll({ where: { submitId: dbsubmit.id }, order: [['dt', 'ASC'], ['id', 'ASC']] })
        for (const submitactionlog of submitactionlogs) {
          console.log(dbsubmit.id, submitactionlog.onUserId, submitactionlog.sentPubMailTemplateId)
        }

        const dbreviewers = await dbsubmit.getReviewers()
        for (const dbreviewer of dbreviewers) {
          console.log('===', dbreviewer.userId)
          const dbuser = await models.users.findByPk(dbreviewer.userId)

          const reviewerLine = [dbsubmit.id, dbflow.name, dbuser.username]
          for (const dbflowgrade of dbflowgrades) {
            console.log('~~~', dbflowgrade.sentpubmailtemplateId, dbreviewer.userId)
            let dtFirstTold = ''
            let dtReviewed = ''
            let review = ''
            let elapsed = ''

            if (dbflowgrade.sentpubmailtemplateId) {
              const firstTold = _.find(submitactionlogs, (sal) => { return sal.sentPubMailTemplateId === dbflowgrade.sentpubmailtemplateId && sal.onUserId === dbreviewer.userId })
              if (firstTold) {
                console.log('+++', firstTold.id, firstTold.dt)
                dtFirstTold = firstTold.dt
              } else console.log('--- Not found')
            }
            const dbusergrading = _.find(dbgradings, (dbgrading) => { return dbgrading.userId === dbreviewer.userId && dbgrading.flowgradeId === dbflowgrade.id })

            if (dbusergrading) {
              const score = _.find(dbflowgrade.flowgradescores, _score => { return _score.id === dbusergrading.flowgradescoreId })
              if (score) {
                review = score.name
                dtReviewed = dbusergrading.dt
                if (dtFirstTold) {
                  const timeDiff = dtReviewed.getTime() - dtFirstTold.getTime()
                  let elapsedmins = Math.floor(timeDiff / 1000 / 60)
                  console.log('elapsedmins', elapsedmins)
                  if (elapsedmins >= 60) {
                    let elapsedhours = Math.floor(elapsedmins / 60)
                    if (elapsedhours >= 24) {
                      const elapseddays = Math.floor(elapsedhours / 24)
                      elapsed = elapseddays + ' days, '
                      elapsedhours -= elapseddays * 24
                      elapsedmins -= elapseddays * 24 * 60
                    }
                    elapsed += elapsedhours + ' hours, '
                    elapsedmins -= elapsedhours * 60
                  }
                  elapsed += elapsedmins + ' mins'
                }
              }
            }
            reviewerLine.push(dtFirstTold)
            reviewerLine.push(dtReviewed)
            reviewerLine.push(review)
            reviewerLine.push(elapsed)
          }
          writeCSVline(outStream, reviewerLine)
        }
      }
    }

    await closeFile(outStream)

    /// ///////
    // Send file
    sendFile(res, saveFilename)
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}
/* ************************ */

function deleteFolderRecursivelySync (dirpath) {
  const files = fs.readdirSync(dirpath)
  files.forEach(file => {
    const _path = dirpath + '/' + file
    if (fs.lstatSync(_path).isDirectory()) {
      deleteFolderRecursivelySync(_path)
    } else {
      fs.unlinkSync(_path)
    }
  })
  fs.rmdirSync(dirpath)
}

/* ************************ */

async function writeAnonEntryValues (fields, dbentry, anonStream) {
  const dbentryvalues = await dbentry.getEntryValues()
  for (const formfield of fields) {
    if (formfield.hideatgrading) continue // Doesn't check that submit is at this grading
    const dbentryvalue = _.find(dbentryvalues, _dbentryvalue => { return formfield.id === _dbentryvalue.formfieldId })
    if (dbentryvalue) {
      const entryvalue = models.sanitise(models.entryvalues, dbentryvalue)
      const stringvalue = await dbutils.getEntryStringValue(entryvalue, formfield)
      anonStream.write(formfield.label + '\r' + stringvalue + '\r\r')
    } else {
      // Write empty line if no entryvalue
      anonStream.write(formfield.label + '\r\r')
    }
  }
}

/* ************************ */

module.exports = router
