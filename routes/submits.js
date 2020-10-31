/*
  1=pub-access 2=Author-access 3=Other-roles=access 4=only-if-open-to-author
  5 6 7 8 Jest tests for 1 2 3 4
  Y=Done N=Todo _=n/a *=urgent
  12345678
  Y_Y_N_N_  PUT     /submits/entry/:entryid                 editEntry         change entry
  Y_Y_N_N_  DELETE  /submits/entry/:entryid                 deleteEntry       delete entry
  .YYYNNNN  POST    /submits/entry                          addEntry          add entry to existing submit
  .YYYNNNN  POST    /submits/submit/:flowid                 addNewSubmit      add new submit and entry
* .NN_NNN_  GET     /submits/entry/:entryid/:entryvalueid   getEntryFile      download a file ie one field of an entry
  .YY_NNN_  GET     /submits/entry/:entryid                 getEntry          get an entry
  .NN_NNN_  GET     /submits/formfields/:flowstageId        getFlowFormFields get the list of fields used in a stage
  .YYYNNNN  GET     /submits/pub/:pubid                     getPubSubmits
  .YY_NNN_  PATCH   /submits/:submitid                      editSubmit        edit submit title and author
  .YY_NNN_  DELETE  /submits/:submitid                      deleteSubmit      delete submit and all entries, etc
  .YY_NNN_  DELETE  /submits/status/:id                     deleteSubmitStatus
  .YY_NNN_  POST    /submits/status/:id                     addSubmitStatus
*/
const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const _ = require('lodash/core')
const logger = require('../logger')
const dbutils = require('./dbutils')
const mailutils = require('./mailutils')

const TMPDIR = '/tmp/papers/'
const TMPDIRARCHIVE = '/tmp/papers/archive' // Without final slash.  Deleted files go here (to be deleted on server reboot)

const upload = multer({ dest: TMPDIR })

const router = Router()

// PUT, PATCH and DELETE verbs are sent using POST with x-http-method-override header

// PUT change whole entry
// PATCH change part of entry
// DELETE delete entry

/* ************************ */
/**
* POST DELETE and PUT entry
*
* PARAMS, FORMDATA & ACCESS PUB: Done by called functions
*/
async function handleEntryPost (req, res, next) {
  // console.log('/submits/entry/id ', req.headers['x-http-method-override'])
  if (req.headers['x-http-method-override'] === 'PUT') {
    await editEntry(req, res, next)
    return
  }
  if (req.headers['x-http-method-override'] === 'DELETE') {
    req.entryid = req.params.entryid
    const ok = await deleteEntry(req, res, next)
    utils.returnOK(req, res, ok, 'ok')
    return
  }
  utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
}
router.post('/submits/entry/:entryid', upload.array('files'), handleEntryPost)

/* ************************ */
/* ACCESS: TESTED */
/* OPEN: TESTED */
async function addEntry (req, res, next) {
  try {
    const filesdir = req.site.privatesettings.files // eg /var/sites/papersdevfiles NO FINAL SLASH

    if (!req.dbsubmit) {
      req.dbsubmit = await models.submits.findByPk(req.submitId)
      if (!req.dbsubmit) return utils.giveup(req, res, 'Could not find submit', req.submitId)
    }

    const error = await dbutils.getSubmitFlowPub(req, 0)
    if (error) return utils.giveup(req, res, error)

    const notallowed = await oktoadd(req, res)
    if (!notallowed) return

    const now = new Date()
    const entry = {
      dt: now,
      submitId: req.submitId,
      flowstageId: req.body.stageid
    }
    const dbentry = await models.entries.create(entry)
    if (!dbentry) return utils.giveup(req, res, 'Could not create entry')
    logger.log4req(req, 'CREATED entry', dbentry.id)

    if (!filesdir) return utils.giveup(req, res, 'Files storage directory not defined')
    for (const file of req.files) {
      // console.log("FILE", file)
      const hyphenpos = file.originalname.indexOf('-')
      if (hyphenpos === -1) return utils.giveup(req, res, 'Bad file originalname format')
      file.formfieldid = parseInt(file.originalname.substring(0, hyphenpos))
      file.originalname = file.originalname.substring(hyphenpos + 1)

      // Move file to filesdir/<siteid>/<pubid>/<flowid>/<submitid>/<entryid>/
      let filepath = '/' + req.site.id + '/' + req.body.pubid + '/' + req.body.flowid + '/' + req.body.submitid + '/' + dbentry.id
      fs.mkdirSync(filesdir + filepath, { recursive: true })
      filepath += '/' + file.originalname
      fs.renameSync(file.path, filesdir + filepath)
      file.filepath = filepath
      logger.log4req(req, 'Uploaded file', filesdir + filepath)
    }

    const values = (typeof req.body.values === 'string') ? [req.body.values] : req.body.values // Single value comes in as string; otherwise array
    for (const sv of values) {
      const v = JSON.parse(sv)
      if (v.string && v.string.length > 255) v.string = v.string.substring(0, 255)
      if (v.file) {
        let found = false
        for (const file of req.files) {
          if (v.formfieldid === file.formfieldid) { // was ==
            v.file = file.filepath
            found = true
          }
        }
        if (!found) return utils.giveup(req, res, 'entry value file not found: ' + v.formfieldid)
      }
      const entryvalue = {
        entryId: dbentry.id,
        formfieldId: v.formfieldid,
        string: v.string,
        text: v.text,
        integer: v.integer,
        file: v.file
      }
      const dbentryvalue = await models.entryvalues.create(entryvalue)
      if (!dbentryvalue) return utils.giveup(req, res, 'Could not create entryvalue')
      logger.log4req(req, 'CREATED entryvalue', dbentryvalue.id)
    }

    const rv = {
      id: dbentry.id,
      submitid: req.submitId
    }

    // Add to submitstatuses
    // Find flow status that should be set when this flow stage is submitted - usually just one
    const dbflowstatuses = await models.flowstatuses.findAll({ where: { submittedflowstageId: req.body.stageid } })
    for (const dbflowstatus of dbflowstatuses) {
      const now = new Date()
      const submitstatus = {
        dt: now,
        submitId: rv.submitid,
        flowstatusId: dbflowstatus.id
      }
      // console.log('addSubmitEntry submitstatus', submitstatus)
      const dbsubmitstatus = await models.submitstatuses.create(submitstatus)
      if (!dbsubmitstatus) return utils.giveup(req, res, 'Could not create submitstatus')
      logger.log4req(req, 'CREATED submitstatus', dbsubmitstatus.id)

      // Send out mails for this status
      await mailutils.sendOutMails(req, dbflowstatus, false, dbentry, false)
    }

    // Return OK
    return rv
  } catch (e) {
    utils.giveup(req, res, e.message)
    console.log(e.stack)
  }
}

/* ************************ */
async function oktoadd (req, res) {
  if ('checkedoktoadd' in req) return true

  // Set req.isowner, req.onlyanauthor and req.myroles for this publication
  if (!await dbutils.getMyRoles(req)) return utils.giveup(req, res, 'No access to this publication')

  // Find this flow stage
  const flowstageid = parseInt(req.body.stageid)
  const dbflowstage = await models.flowstages.findByPk(flowstageid)
  if (!dbflowstage) return utils.giveup(req, res, 'flowstageid not found: ' + flowstageid)

  // Check I am allowed to submit this stage type
  let oktoadd = false
  if (dbflowstage.rolecanadd) {
    const canadd = _.find(req.myroles, (role) => { return role.id === dbflowstage.rolecanadd })
    if (canadd) oktoadd = true
  }
  if (dbflowstage.pubroleId) {
    const canadd = _.find(req.myroles, (role) => { return role.id === dbflowstage.pubroleId })
    if (canadd) oktoadd = true
  }
  if (!oktoadd) return utils.giveup(req, res, 'You are not allowed to add this entry')

  // Check if this stage is open
  const flow = await dbutils.getFlowWithFlowgrades(req.dbflow)
  flow.acceptings = models.sanitiselist(await req.dbflow.getFlowAcceptings(), models.flowacceptings)
  const accepting = _.find(flow.acceptings, accepting => { return accepting.flowstageId === flowstageid })
  if (accepting) {
    if (accepting.flowstatusId === null) {
      if (!accepting.open) return utils.giveup(req, res, 'Sorry, entries are closed at the moment')
    } else {
      const submit = {}
      await dbutils.getSubmitCurrentStatus(req, req.dbsubmit, submit, flow)
      if (req.currentstatus && (req.currentstatus.flowstatusId === accepting.flowstatusId)) {
        if (!accepting.open) return utils.giveup(req, res, 'Sorry, entries are closed at the moment')
      }
    }
  }
  req.checkedoktoadd = true
  return true
}

/* ************************ */
/* POST add entry
    Get FormData using https://www.npmjs.com/package/multer
    This copes with ONE file but means that form values are all (JSON) strings which will need parsed if an object

    multer upload sets req.files eg as follows:
    [{ fieldname: 'file',
      originalname: 'Damsons.doc',
      encoding: '7bit',
      mimetype: 'application/msword',
      destination: '/tmp/papers/',
      filename: 'ce0060fb35a0c91555c7d24136a58581',
      path: '/tmp/papers/ce0060fb35a0c91555c7d24136a58581',
      size: 38912 }]
*/
router.post('/submits/entry', upload.array('files'), async function (req, res, next) {
  req.submitId = req.body.submitid
  const rv = await addEntry(req, res, next)
  if (!rv) return
  utils.returnOK(req, res, rv, 'rv')
})

/* ************************ */
/* POST add new submit with first entry */
/* ACCESS: TESTED */
/* OPEN: TESTED */
async function addNewSubmit (req, res, next) {
  try {
    console.log('addSubmitEntry', req.params.flowid)

    const flowid = parseInt(req.params.flowid)

    req.dbflow = await models.flows.findByPk(flowid)
    if (!req.dbflow) return utils.giveup(req, res, 'Could not find flow', flowid)

    req.dbpub = await req.dbflow.getPub()
    if (!req.dbpub) return utils.giveup(req, res, 'Could not find pub for flow', flowid)

    const notallowed = await oktoadd(req, res)
    if (!notallowed) return

    // Start adding...
    const now = new Date()
    const submit = {
      flowId: flowid,
      userId: req.dbuser.id,
      name: req.body.title,
      startdt: now
    }
    console.log('addSubmitEntry submit', submit)
    const dbsubmit = await models.submits.create(submit)
    if (!dbsubmit) return utils.giveup(req, res, 'Could not create submit')
    logger.log4req(req, 'CREATED submit', dbsubmit.id)

    req.submitId = dbsubmit.id
    req.dbsubmit = dbsubmit
    const rv = await addEntry(req, res, next)
    if (!rv) return

    // All done
    utils.returnOK(req, res, rv, 'rv')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}
router.post('/submits/submit/:flowid', upload.array('files'), addNewSubmit)

/**
* POST PUT edit entry
*
* PARAMS: entryid validated
* FORMDATA: TODO better
*
* ACCESS PUB: DOES TESTS
*        AUTHOR: NO. DOES TESTS
*        OWNER-ONLY: YES. DOES TESTS
*        OPEN: N/A
*/

async function editEntry (req, res, next) {
  try {
    console.log('editEntry', req.params.entryid)
    const filesdir = req.site.privatesettings.files // eg /var/sites/papersdevfiles NO FINAL SLASH
    if (!filesdir) return utils.giveup(req, res, 'Files storage directory not defined')

    const entryid = parseInt(req.params.entryid)
    const dbentry = await models.entries.findByPk(entryid)
    if (!dbentry) return utils.giveup(req, res, 'Invalid entryid')

    req.dbsubmit = await dbentry.getSubmit()
    if (!req.dbsubmit) return utils.giveup(req, res, 'No submit for entryid')

    // Got dbsubmit, but get flow, pub, roles, etc
    const error = await dbutils.getSubmitFlowPub(req, 0)
    if (error) return utils.giveup(req, res, error)

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    // Don't need to change anything in entry ie leave creation dt alone

    // If replacement files given
    for (const file of req.files) {
      // console.log('editEntry',file)
      const hyphenpos = file.originalname.indexOf('-')
      if (hyphenpos === -1) return utils.giveup(req, res, 'Bad file originalname format')
      file.formfieldid = parseInt(file.originalname.substring(0, hyphenpos))
      file.originalname = file.originalname.substring(hyphenpos + 1)

      // Find any existing file
      const dbentryvalues = await dbentry.getEntryValues()
      let existingfile = false
      for (const dbentryvalue of dbentryvalues) {
        if (dbentryvalue.file != null && dbentryvalue.formfieldId === file.formfieldid) {
          existingfile = dbentryvalue.file
          break
        }
      }
      if (existingfile) {
        const existingpath = filesdir + existingfile
        if (fs.existsSync(existingpath)) {
          const archivepath = TMPDIRARCHIVE + existingpath
          if (fs.existsSync(archivepath)) {
            // Do we need to delete?
            console.log('editEntry archivepath exists')
          }
          const archivedir = path.dirname(archivepath)
          // Make archive dir
          fs.mkdirSync(archivedir, { recursive: true })
          // Move existing file to archive
          fs.renameSync(existingpath, archivepath)
        }
      }

      let filepath = '/' + req.site.id + '/' + req.body.pubid + '/' + req.body.flowid + '/' + req.body.submitid + '/' + dbentry.id
      fs.mkdirSync(filesdir + filepath, { recursive: true })
      filepath += '/' + file.originalname
      fs.renameSync(file.path, filesdir + filepath)
      file.filepath = filepath
      logger.log4req(req, 'Uploaded file', filesdir + filepath)
    }

    // OK: Now delete any existing entryvalues
    const affectedRows = await models.entryvalues.destroy({ where: { entryId: entryid } })
    logger.log4req(req, 'Deleted entryvalues', entryid, affectedRows)

    // And then store the new ones
    for (const sv of req.body.values) {
      const v = JSON.parse(sv)
      if (v.string && v.string.length > 255) v.string = v.string.substring(0, 255)
      if (v.file) {
        let found = false
        for (const file of req.files) {
          if (v.formfieldid === file.formfieldid) { // was ==
            v.file = file.filepath
            found = true
          }
        }
        if (!found) return utils.giveup(req, res, 'entry value file not found: ' + v.formfieldid)
      } else if (v.existingfile) v.file = v.existingfile
      const entryvalue = {
        entryId: dbentry.id,
        formfieldId: v.formfieldid,
        string: v.string,
        text: v.text,
        integer: v.integer,
        file: v.file
      }
      const dbentryvalue = await models.entryvalues.create(entryvalue)
      if (!dbentryvalue) return utils.giveup(req, res, 'Could not create entryvalue')
      logger.log4req(req, 'CREATED entryvalue', dbentryvalue.id)
    }
    logger.log4req(req, "entry's values updated", dbentry.id)
    utils.returnOK(req, res, dbentry.id, 'id')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST DELETE entry */
/**
* POST PUT edit entry
*
* PARAMS: entryid validated
* FORMDATA: N/A
*
* ACCESS PUB: DOES TESTS
*        AUTHOR: NO. DOES TESTS
*        OWNER-ONLY: YES. DOES TESTS
*        OPEN: N/A
*/
async function deleteEntry (req, res, next) {
  try {
    console.log('deleteEntry', req.entryid)

    const filesdir = req.site.privatesettings.files // eg /var/sites/papersdevfiles NO FINAL SLASH

    const entryid = parseInt(req.entryid)
    const dbentry = await models.entries.findByPk(entryid)
    if (!dbentry) return utils.giveup(req, res, 'Invalid entryid')

    req.dbsubmit = await dbentry.getSubmit()
    if (!req.dbsubmit) return utils.giveup(req, res, 'No submit for entryid')

    // Got dbsubmit, but get flow, pub, roles, etc
    const error = await dbutils.getSubmitFlowPub(req, 0)
    if (error) return utils.giveup(req, res, error)

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    // Find entryvalues; move any files to TMPDIRARCHIVE
    const dbentryvalues = await dbentry.getEntryValues()
    for (const dbentryvalue of dbentryvalues) {
      if (dbentryvalue.file != null) {
        let base = path.dirname(dbentryvalue.file)
        // const filename = path.basename(dbentryvalue.file)
        fs.mkdirSync(TMPDIRARCHIVE + base, { recursive: true })
        const frompath = filesdir + dbentryvalue.file
        if (!fs.existsSync(frompath)) {
          logger.warn4req(req, 'FILE DOES NOT EXIST', frompath)
        } else {
          try {
            fs.renameSync(frompath, TMPDIRARCHIVE + dbentryvalue.file)
            logger.log4req(req, 'Archived file', frompath, TMPDIRARCHIVE + dbentryvalue.file)
          } catch (e) {
            logger.warn4req(req, 'COULD NOT MOVE', frompath, 'TO', TMPDIRARCHIVE + dbentryvalue.file)
          }
        }
        // Delete any empty directories, down through hieracrhy
        while (base !== '/') {
          try {
            fs.rmdirSync(filesdir + base)
            logger.log4req(req, 'Removed directory', filesdir + base)
          } catch (e) {
            break
          }
          // const dirname = path.basename(base)
          base = path.dirname(base)
        }
      }
    }

    // Finally delete the entryvalues and entry
    let affectedRows = await models.entryvalues.destroy({ where: { entryId: entryid } })
    logger.log4req(req, 'Deleted entryvalues', entryid, affectedRows)
    affectedRows = await models.entries.destroy({ where: { id: entryid } })
    logger.log4req(req, 'Deleted entry', entryid, affectedRows)

    const ok = affectedRows === 1
    return ok
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* GET file for entry formfield */
async function getEntryFile (req, res, next) {
  try {
    const entryid = parseInt(req.params.entryid)
    const entryvalueid = parseInt(req.params.entryvalueid)
    console.log('GET /submits/entry/ file', entryid, entryvalueid, req.dbuser.id)
    if (!Number.isInteger(req.dbuser.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const dbentry = await models.entries.findByPk(entryid)
    if (!dbentry) return utils.giveup(req, res, 'Invalid entryid')

    const dbentryvalue = await models.entryvalues.findByPk(entryvalueid)
    if (!dbentryvalue) return utils.giveup(req, res, 'Invalid entryvalueid')

    const refEntry = await dbentryvalue.getEntry()
    if (!refEntry) return utils.giveup(req, res, 'Invalid refEntry')
    if (refEntry.id !== entryid) return utils.giveup(req, res, 'Invalid refEntry.')

    if (dbentryvalue.file === null) return utils.giveup(req, res, 'No file for that entry')

    const ContentType = mime.lookup(dbentryvalue.file)
    const filesdir = req.site.privatesettings.files // /var/sites/papersdevfiles NO FINAL SLASH
    const options = {
      root: filesdir,
      dotfiles: 'deny',
      headers: {
        'Content-Type': ContentType
      }
    }
    res.sendFile(dbentryvalue.file, options)
    logger.log4req(req, 'Sending file', dbentryvalue.file)
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}
router.get('/submits/entry/:entryid/:entryvalueid', getEntryFile)

/* ************************ */
/* GET entry and associated formfields */
/* ACCESS: TO TEST */
async function getEntry (req, res, next) {
  try {
    const entryid = parseInt(req.params.entryid)
    console.log('GET /submits/entry/', entryid, req.dbuser.id)

    if (!Number.isInteger(req.dbuser.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const dbentry = await models.entries.findByPk(entryid)
    if (!dbentry) return utils.giveup(req, res, 'Invalid entryid')

    req.dbsubmit = await dbentry.getSubmit()
    if (!req.dbsubmit) return utils.giveup(req, res, 'No submit for entryid')

    if (req.dbsubmit.userId !== req.dbuser.id) {
      /// /////// If not mine, then check if I can see it and set up for actions
      const submit = models.sanitise(models.submits, req.dbsubmit)

      // Got dbsubmit, but get flow, pub, roles, etc
      const error = await dbutils.getSubmitFlowPub(req, 0)
      if (error) return utils.giveup(req, res, error)

      const flow = await dbutils.getFlowWithFlowgrades(req.dbflow)

      // Get all possible flow statuses
      const dbstatuses = await req.dbflow.getFlowStatuses({ order: [['weight', 'ASC']] })
      flow.statuses = models.sanitiselist(dbstatuses, models.flowstatuses)
      // Get all possible flow stages
      const dbstages = await req.dbflow.getFlowStages({ order: [['weight', 'ASC']] })
      flow.stages = models.sanitiselist(dbstages, models.flowstages)

      // Get submit's statuses and currentstatus
      submit.ismine = false
      await dbutils.getSubmitCurrentStatus(req, req.dbsubmit, submit, flow)
      if (!req.currentstatus) { // If no statuses, then give up here
        return utils.giveup(req, res, 'No statuses for this submit')
      }

      req.dbsubmitgradings = await req.dbsubmit.getGradings()

      let ihaveactions = await dbutils.addAuthorStageActions(req, flow, submit)

      if (await dbutils.addRoleStageActions(req, flow, submit)) {
        ihaveactions = true
      }

      /// /////// Filter submits ie only show if you are reviewing
      if (!ihaveactions) {
        const includethissubmit = await dbutils.isReviewableSubmit(req, flow, false)
        if (!includethissubmit) {
          return utils.giveup(req, res, 'Not your submit entry')
        }
      }
    }

    const entry = models.sanitise(models.entries, dbentry)

    await dbutils.getEntryFormFields(entry, dbentry.flowstageId)

    entry.values = []
    for (const dbentryvalue of await dbentry.getEntryValues()) {
      const entryvalue = models.sanitise(models.entryvalues, dbentryvalue)
      if (req.iamgrading) {
        const field = _.find(entry.fields, field => { return field.id === entryvalue.formfieldId })
        if (field.hideatgrading && (field.hideatgrading === req.iamgradingat)) continue
      }
      entry.values.push(entryvalue)
    }

    // console.log('entry', entry)
    logger.log4req(req, 'Returning entry', entryid)
    utils.returnOK(req, res, entry, 'entry')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}
router.get('/submits/entry/:entryid', getEntry)

/* ************************ */
/* GET formfields for specified flowstageId */
async function getFlowFormFields (req, res, next) {
  try {
    const flowstageId = parseInt(req.params.flowstageId)
    console.log('GET /submits/formfields/', flowstageId, req.dbuser.id)

    if (!Number.isInteger(req.dbuser.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const entry = {}
    await dbutils.getEntryFormFields(entry, flowstageId)

    // console.log('entry', entry)
    logger.log4req(req, 'Returning formfields', flowstageId)
    utils.returnOK(req, res, entry, 'entry')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}
router.get('/submits/formfields/:flowstageId', getFlowFormFields)

/* ************************ */
/* GET submits for publication
 *
 * A biggy:
 * - gets list of submits that should be shown to a user
 *   - if author
 *   - if owner: show admin options
 *   - if can grade because latest status matches grade that is visible to role - that user has
 *   - if can grade because latest status matches grade that is visible to reviewers - and user is one of the reviewers
 *   - if is editor TODO
 *   - if is on editorial committee TODO
 * - ?? Hide author details if grading

*/
/* ACCESS: TO TEST */
async function getPubSubmits (req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /submits/pub/', pubid)

    req.dbpub = await models.pubs.findByPk(pubid)
    if (!req.dbpub) return utils.giveup(req, res, 'Invalid pubs:id')

    // Set req.isowner, req.onlyanauthor and req.myroles for this publication
    if (!await dbutils.getMyRoles(req)) return utils.giveup(req, res, 'No access to this publication')

    /// ///////
    const dbflows = await req.dbpub.getFlows()
    const flows = []
    for (const dbflow of dbflows) {
      /// /////// FOR THIS FLOW

      const flow = await dbutils.getFlowWithFlowgrades(dbflow)

      // Find all candidate submits ie just user's or all of them
      flow.submits = []
      let dbsubmits = false
      if (req.onlyanauthor) { // Just get mine
        dbsubmits = await dbflow.getSubmits({ where: { userId: req.dbuser.id } })
      } else { // Otherwise: get all submits and filter
        dbsubmits = await dbflow.getSubmits()
      }

      // Get all possible flow statuses
      const dbstatuses = await dbflow.getFlowStatuses({ order: [['weight', 'ASC']] })
      flow.statuses = models.sanitiselist(dbstatuses, models.flowstatuses)

      // Get 'acceptings' ie details of which flow stages are open
      flow.acceptings = models.sanitiselist(await dbflow.getFlowAcceptings(), models.flowacceptings)

      // Get all possible flow stages
      const dbstages = await dbflow.getFlowStages({ order: [['weight', 'ASC']] })
      flow.stages = models.sanitiselist(dbstages, models.flowstages)

      /// /////// Set up flow-level actions that are possible
      flow.actions = [] // Allowable actions
      for (const accepting of flow.acceptings) {
        if (_.isNull(accepting.flowstatusId) && accepting.open) {
          const addstage = _.find(flow.stages, stage => { return stage.id === accepting.flowstageId })
          if (addstage && req.isauthor) {
            flow.actions.push({
              name: 'Add new ' + addstage.name,
              route: '/panel/' + pubid + '/' + flow.id + '/add/' + addstage.id
            })
          }
        }
      }

      /// /////// GO THROUGH ALL FLOW'S SUBMITS
      req.entergradingcount = 0
      for (const dbsubmit of dbsubmits) {
        req.dbsubmit = dbsubmit
        const submit = models.sanitise(models.submits, dbsubmit)

        req.dbsubmitgradings = await dbsubmit.getGradings()

        submit.actionsdone = [] // Actions done

        submit.user = ''
        submit.ismine = true
        if (dbsubmit.userId !== req.dbuser.id) {
          const dbauthor = await dbsubmit.getUser()
          submit.user = dbauthor.name
          submit.ismine = false
        }

        // Get submit's statuses and currentstatus
        await dbutils.getSubmitCurrentStatus(req, dbsubmit, submit, flow)
        if (!req.currentstatus) { // If no statuses, then only return to owner
          if (!req.isowner) continue
        }

        /// /////// Add actions to Add next stage (if appropriate).  Sets submit.actions
        let ihaveactions = await dbutils.addAuthorStageActions(req, flow, submit)

        if (await dbutils.addRoleStageActions(req, flow, submit)) {
          ihaveactions = true
        }

        /// /////// We'll need the entries (ordered by flowstage weight) so we can get action links
        const dbentries = await dbsubmit.getEntries({
          include: { model: models.flowstages },
          order: [
            [models.flowstages, 'weight', 'ASC']
          ]
        })
        submit.entries = models.sanitiselist(dbentries, models.entries)

        /// /////// Filter submits
        req.iamgrading = false
        req.iamleadgrader = false
        if (!ihaveactions && !req.onlyanauthor && !req.isowner) {
          const includethissubmit = await dbutils.isReviewableSubmit(req, flow, submit)
          if (!includethissubmit) continue
        }

        const reviewers = []
        for (const dbreviewer of await req.dbsubmit.getReviewers()) {
          const reviewer = models.sanitise(models.submitreviewers, dbreviewer)
          const dbuser = await dbreviewer.getUser()
          reviewer.username = dbuser ? dbuser.name : ''

          reviewer.sentreminders = []
          const dbsentreminders = await models.sentreminders.findAll({ where: { userId: dbreviewer.userId, submitId: req.dbsubmit.id } })
          for (const dbsentreminder of dbsentreminders) {
            reviewer.sentreminders.push({ id: dbsentreminder.id, dt: dbsentreminder.dt })
          }

          reviewers.push(reviewer)
        }
        const returnreviewers = req.isowner || req.iamleadgrader
        submit.reviewers = returnreviewers ? reviewers : []

        // Decide which gradings to return
        // - if owner then return all
        // - if canviewall then return all except if role means I'm grading
        // - If author: return when grading at a status in authorcanseeatthesestatuses
        // - If reviewer: add/see your own (but can't see earlier abstract scores)

        // If owner, then return summary in actionsdone
        const ownergradingsummary = []

        let authorhasgradingstosee = false
        submit.gradings = []
        for (const dbgrading of req.dbsubmitgradings) {
          let returnthisone = req.isowner
          if (submit.ismine) {
            const flowgrade = _.find(flow.flowgrades, (flowgrade) => { return flowgrade.id === dbgrading.flowgradeId })
            if (flowgrade && flowgrade.authorcanseeatthesestatuses) {
              const canseeat = flowgrade.authorcanseeatthesestatuses.split(',')
              const found = _.find(canseeat, (flowgradeid) => { return parseInt(flowgradeid) === req.currentstatus.flowstatusId })
              if (found) {
                returnthisone = true
                submit.gradings.push({ flowgradeId: dbgrading.flowgradeId, comment: dbgrading.comment })
                authorhasgradingstosee = true
              }
            }
          }
          let overrideviewall = false
          if (req.iamgrading) {
            const flowgrade = _.find(flow.flowgrades, (flowgrade) => { return flowgrade.id === dbgrading.flowgradeId })
            if (flowgrade) {
              if (req.iamleadgrader) returnthisone = true
              if (dbgrading.userId === req.dbuser.id) returnthisone = true
              else overrideviewall = true
            }
          }
          if (req.canviewall && !overrideviewall) {
            returnthisone = true
          }

          if (returnthisone) {
            if (!submit.ismine) {
              const grading = models.sanitise(models.submitgradings, dbgrading)
              if (!req.onlyanauthor) {
                const reviewer = _.find(reviewers, (reviewer) => { return reviewer.userId === grading.userId })
                grading.lead = reviewer ? reviewer.lead : false
                const dbgrader = await dbgrading.getUser()
                grading.username = ''
                grading.hasReviewerRole = false
                if (dbgrader) {
                  grading.username = dbgrader.name
                  const dbgraderpubroles = await dbgrader.getRoles()
                  const isreviewerrole = _.find(dbgraderpubroles, (grader) => { return grader.isreviewer })
                  if (isreviewerrole) grading.hasReviewerRole = true
                }
              }
              submit.gradings.push(grading)
              if (req.isowner) {
                const flowgrade = _.find(flow.flowgrades, (flowgrade) => { return flowgrade.id === dbgrading.flowgradeId })
                if (flowgrade) {
                  const existinggrade = _.find(ownergradingsummary, (og) => { return og.id === flowgrade.id })
                  if (existinggrade) existinggrade.count++
                  else ownergradingsummary.push({ id: flowgrade.id, name: flowgrade.name, count: 1 })
                }
              }
            }
          }
        }
        if (authorhasgradingstosee) {
          const route = '/panel/' + pubid + '/' + flow.id + '/' + submit.id
          submit.actions.push({ name: 'See reviews', route, show: 1, dograde: 0 })
        }
        for (const og of ownergradingsummary) {
          submit.actionsdone.push({ id: -og.id, name: og.name + ': ' + og.count + ' done' })
        }

        submit.actionable = submit.actions.length > 0

        /// /////// Add submit to return list
        flow.submits.push(submit)
      }
      // Add Next and Previous buttons for graders
      if (req.entergradingcount > 1) {
        const submitswithgradingstodo = []
        for (const submit of flow.submits) {
          if (submit.actions.length > 0) {
            const action = submit.actions[0]
            if (action.dograde === 4) {
              submitswithgradingstodo.push(submit)
            }
          }
        }
        if (submitswithgradingstodo.length > 1) {
          for (let submitno = 0; submitno < submitswithgradingstodo.length; submitno++) {
            const submit = submitswithgradingstodo[submitno]
            if (submitno < submitswithgradingstodo.length - 1) {
              const nextsubmit = submitswithgradingstodo[submitno + 1]
              const route = '/panel/' + req.dbpub.id + '/' + nextsubmit.flowId + '/' + nextsubmit.id + '/' + nextsubmit.actions[0].entrytograde
              submit.actions.push({ name: 'Next', gradename: '', route, flowgradeid: 0, show: 4, dograde: 0 })
            }
            if (submitno > 0) {
              const prevsubmit = submitswithgradingstodo[submitno - 1]
              const route = '/panel/' + req.dbpub.id + '/' + prevsubmit.flowId + '/' + prevsubmit.id + '/' + prevsubmit.actions[0].entrytograde
              submit.actions.push({ name: 'Previous', gradename: '', route, flowgradeid: 0, show: 4, dograde: 0 })
            }
          }
        }
      }

      // console.log('flow.actions', flow.actions)
      flows.push(flow)
    }

    logger.log4req(req, 'Returning flows', pubid)
    utils.returnOK(req, res, flows, 'flows')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}
router.get('/submits/pub/:pubid', getPubSubmits)

/* ************************ */
/* POST DELETE submit or PATCH submit edit */
router.post('/submits/:submitid', async function (req, res, next) {
  if (req.headers['x-http-method-override'] === 'PATCH') {
    await editSubmit(req, res, next)
    return
  }
  if (req.headers['x-http-method-override'] === 'DELETE') {
    await deleteSubmit(req, res, next)
    return
  }
  utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST DELETE submit */
/* ACCESS: OWNER-ONLY TESTED */
async function deleteSubmit (req, res, next) {
  const submitid = parseInt(req.params.submitid)
  try {
    const error = await dbutils.getSubmitFlowPub(req, submitid)
    if (error) return utils.giveup(req, res, error)

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    // Delete entries and their contents
    const dbentries = await req.dbsubmit.getEntries()
    for (const dbentry of dbentries) {
      req.entryid = dbentry.id
      const ok = await deleteEntry(req, res, next)
      if (!ok) return
    }

    // Delete statuses
    let affectedRows = await models.submitstatuses.destroy({ where: { submitId: submitid } })

    // Delete submitgradings
    affectedRows = await models.submitgradings.destroy({ where: { submitId: submitid } })

    // Delete submitreviewers
    affectedRows = await models.submitreviewers.destroy({ where: { submitId: submitid } })

    // Delete submit
    affectedRows = await models.submits.destroy({ where: { id: submitid } })

    logger.log4req(req, 'Deleted submit', submitid, affectedRows)

    const ok = affectedRows === 1
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* PATCH edit submit title and author */
/* ACCESS: OWNER-ONLY TESTED */
async function editSubmit (req, res, next) {
  const submitid = parseInt(req.params.submitid)
  try {
    console.log('changeSubmitTitle', req.params.submitid, req.body.newtitle)

    const error = await dbutils.getSubmitFlowPub(req, submitid)
    if (error) return utils.giveup(req, res, error)

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const newauthorid = req.body.newauthor
    if (newauthorid) { // Change if >0
      const dbnewauthor = await models.users.findByPk(newauthorid)
      if (!dbnewauthor) return utils.giveup(req, res, 'New author not found')
      req.dbsubmit.userId = newauthorid
    }

    req.dbsubmit.name = req.body.newtitle
    await req.dbsubmit.save()

    logger.log4req(req, 'Edited submit', submitid, req.body.newtitle, newauthorid)

    const ok = true
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}
/* ************************ */
/* POST DELETE submit status or POST new submit status */
router.post('/submits/status/:id', async function (req, res, next) {
  if (req.headers['x-http-method-override'] === 'DELETE') {
    await deleteSubmitStatus(req, res, next)
    return
  }
  if (req.headers['x-http-method-override'] === 'POST') {
    await addSubmitStatus(req, res, next)
    return
  }
  utils.giveup(req, res, 'Bad method: ' + req.headers['x-http-method-override'])
})

/* ************************ */
/* POST DELETE submit status */
/* ACCESS: OWNER-ONLY TESTED */
async function deleteSubmitStatus (req, res, next) {
  try {
    // console.log('deleteSubmitStatus', req.params.id)

    const submitstatusid = parseInt(req.params.id)
    const dbsubmitstatus = await models.submitstatuses.findByPk(submitstatusid)
    if (!dbsubmitstatus) return utils.giveup(req, res, 'submitstatus not found')

    req.dbsubmit = await dbsubmitstatus.getSubmit()
    if (!req.dbsubmit) return utils.giveup(req, res, 'submit not found')

    const dbflow = await req.dbsubmit.getFlow()
    if (!dbflow) return utils.giveup(req, res, 'flow not found')

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, 'pub not found')

    // Get MY roles in all publications - check isowner
    const dbmypubroles = await req.dbuser.getRoles()
    const isowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!isowner) return utils.giveup(req, res, 'Not an owner')

    const affectedRows = await models.submitstatuses.destroy({ where: { id: submitstatusid } })
    logger.log4req(req, 'Deleted submit status', submitstatusid, affectedRows)

    const ok = affectedRows === 1
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST POST add submit status */
/* ACCESS: OWNER-ONLY TESTED */
async function addSubmitStatus (req, res, next) {
  try {
    const submitid = parseInt(req.params.id)
    const newstatusid = parseInt(req.body.newstatusid)
    // console.log('addSubmitStatus', submitid, newstatusid)

    const error = await dbutils.getSubmitFlowPub(req, submitid)
    if (error) return utils.giveup(req, res, error)

    if (!req.isowner) return utils.giveup(req, res, 'Not an owner')

    const dbflowstatus = await models.flowstatuses.findByPk(newstatusid)
    if (!dbflowstatus) return utils.giveup(req, res, 'Flow status not found')

    const now = new Date()
    const submitstatus = {
      dt: now,
      submitId: submitid,
      flowstatusId: newstatusid
    }
    const dbsubmitstatus = await models.submitstatuses.create(submitstatus)
    if (!dbsubmitstatus) return utils.giveup(req, res, 'Could not create submitstatus')
    const newsubmitstatus = models.sanitise(models.submitstatuses, dbsubmitstatus)

    logger.log4req(req, 'Created submit status', submitid, newstatusid, dbsubmitstatus.id)

    // Send out mails for this status
    await mailutils.sendOutMails(req, dbflowstatus, false, false, false)

    utils.returnOK(req, res, newsubmitstatus, 'submitstatus')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */

module.exports = router
