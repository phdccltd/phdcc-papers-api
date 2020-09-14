const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const Handlebars = require("handlebars")
const _ = require('lodash/core')
const logger = require('../logger')

const TMPDIR = '/tmp/papers/'
const TMPDIRARCHIVE = '/tmp/papers/archive'  // Without final slash.  Deleted files go here (to be deleted on server reboot)

const upload = multer({ dest: TMPDIR })

const router = Router()

  // PUT change whole entry
  // PATCH change part of entry
  // DELETE delete entry

/* ************************ */
/* POST DELETE and PUT entry */
router.post('/submits/entry/:entryid', upload.array('files'), async function (req, res, next) {
  //console.log('/submits/entry/id ', req.headers['x-http-method-override'])
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
})

/* ************************ */
async function addEntry(req, res, next) {
  try {
    const filesdir = req.site.privatesettings.files // eg /var/sites/papersdevfiles NO FINAL SLASH

    if (!req.dbsubmit) {
      req.dbsubmit = await models.submits.findByPk(req.submitId)
      if (!req.dbsubmit) return utils.giveup(req, res, 'Could not find submit', req.submitId)
    }

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
      //console.log("FILE", file)
      const hyphenpos = file.originalname.indexOf('-')
      if (hyphenpos === -1) return utils.giveup(req, res, 'Bad file originalname format')
      file.formfieldid = parseInt(file.originalname.substring(0, hyphenpos))
      file.originalname = file.originalname.substring(hyphenpos+1)

      // Move file to filesdir/<siteid>/<pubid>/<flowid>/<submitid>/<entryid>/
      let filepath = '/' + req.site.id + '/' + req.body.pubid + '/' + req.body.flowid + '/' + req.body.submitid + '/' + dbentry.id
      fs.mkdirSync(filesdir + filepath, { recursive: true })
      filepath += '/' + file.originalname
      fs.renameSync(file.path, filesdir + filepath)
      file.filepath = filepath
      logger.log4req(req, 'Uploaded file', filesdir + filepath)
    }

    for (const sv of req.body.values) {
      const v = JSON.parse(sv)
      if (v.string && v.string.length > 255) v.string = v.string.substring(0, 255)
      if (v.file) {
        let found = false
        for (const file of req.files) {
          if (v.formfieldid == file.formfieldid) {
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
        file: v.file,
      }
      const dbentryvalue = await models.entryvalues.create(entryvalue)
      if (!dbentryvalue) return utils.giveup(req, res, 'Could not create entryvalue')
      logger.log4req(req, 'CREATED entryvalue', dbentryvalue.id)
    }

    const rv = {
      id: dbentry.id,
      submitid: req.submitId,
    }

    // Add to submitstatuses
    //console.log('addSubmitEntry flowstageid', req.body.stageid)
    // Find this flow stage
    const dbflowstage = await models.flowstages.findByPk(req.body.stageid)
    if (!dbflowstage) return utils.giveup(req, res, 'flowstageid not found: ' + req.body.stageid)

    // Find flow status that should be set when this flow stage is submitted - usually just one
    const dbflowstatuses = await models.flowstatuses.findAll({ where: { submittedflowstageId: req.body.stageid } })
    for (const dbflowstatus of dbflowstatuses) {
      const now = new Date()
      const submitstatus = {
        dt: now,
        submitId: rv.submitid,
        flowstatusId: dbflowstatus.id,
      }
      //console.log('addSubmitEntry submitstatus', submitstatus)
      const dbsubmitstatus = await models.submitstatuses.create(submitstatus)
      if (!dbsubmitstatus) return utils.giveup(req, res, 'Could not create submitstatus')
      logger.log4req(req, 'CREATED submitstatus', dbsubmitstatus.id)

      // Send out mails for this status
      await sendOutMailsForStatus(req, dbflowstatus, dbentry)
    }

    // Return OK
    return rv
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
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
router.post('/submits/submit/:flowid', upload.array('files'), async function (req, res, next) {
  try {
    console.log('addSubmitEntry', req.params.flowid)

    const filesdir = req.site.privatesettings.files // eg /var/sites/papersdevfiles NO FINAL SLASH
    const flowid = parseInt(req.params.flowid)

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

    // Send mails TODO


    // All done
    utils.returnOK(req, res, rv, 'rv')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* POST PUT edit entry */
async function editEntry(req, res, next) {
  try {
    console.log('editEntry', req.params.entryid)
    const filesdir = req.site.privatesettings.files // eg /var/sites/papersdevfiles NO FINAL SLASH

    // Don't need to change anything in entry ie leave creation dt alone
    const entryid = parseInt(req.params.entryid)
    const dbentry = await models.entries.findByPk(entryid)
    if (!dbentry) return utils.giveup(req, res, 'Invalid entryid')

    // If replacement files given
    if (!filesdir) return utils.giveup(req, res, 'Files storage directory not defined')
    for (const file of req.files) {
      //console.log('editEntry',file)
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
          let archivedir = path.dirname(archivepath)
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
    let affectedRows = await models.entryvalues.destroy({ where: { entryId: entryid } })
    logger.log4req(req, 'Deleted entryvalues', entryid, affectedRows)

    // And then store the new ones
    for (const sv of req.body.values) {
      const v = JSON.parse(sv)
      if (v.string && v.string.length > 255) v.string = v.string.substring(0,255)
      if (v.file) {
        let found = false
        for (const file of req.files) {
          if (v.formfieldid == file.formfieldid) {
            v.file = file.filepath
            found = true
          }
        }
        if (!found) return utils.giveup(req, res, 'entry value file not found: ' + v.formfieldid)
      }
      else if (v.existingfile) v.file = v.existingfile
      const entryvalue = {
        entryId: dbentry.id,
        formfieldId: v.formfieldid,
        string: v.string,
        text: v.text,
        integer: v.integer,
        file: v.file,
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
async function deleteEntry(req, res, next) {
  try {
    console.log('deleteEntry', req.entryid)

    // Find entry and entryvalues; move any files to TMPDIRARCHIVE
    const filesdir = req.site.privatesettings.files // eg /var/sites/papersdevfiles NO FINAL SLASH

    const entryid = parseInt(req.entryid)
    const dbentry = await models.entries.findByPk(entryid)
    if (!dbentry) return utils.giveup(req, res, 'Invalid entryid')

    const dbentryvalues = await dbentry.getEntryValues()
    for (const dbentryvalue of dbentryvalues) {
      if (dbentryvalue.file != null) {
        let base = path.dirname(dbentryvalue.file)
        const filename = path.basename(dbentryvalue.file)
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
            fs.rmdirSync(filesdir+base)
            logger.log4req(req, 'Removed directory', filesdir + base)
          } catch (e) {
            break
          }
          const dirname = path.basename(base)
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
router.get('/submits/entry/:entryid/:entryvalueid', async function (req, res, next) {
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
    if (refEntry.id!==entryid) return utils.giveup(req, res, 'Invalid refEntry.')

    if (dbentryvalue.file === null) return utils.giveup(req, res, 'No file for that entry')

    const ContentType = mime.lookup(dbentryvalue.file)
    const filesdir = req.site.privatesettings.files // /var/sites/papersdevfiles NO FINAL SLASH
    var options = {
      root: filesdir,
      dotfiles: 'deny',
      headers: {
        'Content-Type': ContentType,
      }
    }
    res.sendFile(dbentryvalue.file, options)
    logger.log4req(req, 'Sending file', dbentryvalue.file)
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* GET entry and associated formfields */
router.get('/submits/entry/:entryid', async function (req, res, next) {
  try {
    const entryid = parseInt(req.params.entryid)
    console.log('GET /submits/entry/', entryid, req.dbuser.id)

    if (!Number.isInteger(req.dbuser.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const dbentry = await models.entries.findByPk(entryid)
    if (!dbentry) return utils.giveup(req, res, 'Invalid entryid')

    let iamgrading = false

    req.dbsubmit = await dbentry.getSubmit()
      //await models.submits.findByPk(dbentry.submitId)
    if (!req.dbsubmit) return utils.giveup(req, res, 'No submit for entryid')

    if (req.dbsubmit.userId !== req.dbuser.id) {
      ////////// If not mine, then check if I can see it and set up for actions
      const submit = models.sanitise(models.submits, req.dbsubmit)

      const dbflow = await req.dbsubmit.getFlow()
      if (!dbflow) return utils.giveup(req, res, "flow not found")
      const flow = models.sanitise(models.flows, dbflow)

      // Get all grades for this flow
      const dbflowgrades = await dbflow.getFlowgrades()
      flow.flowgrades = []
      for (const dbflowgrade of dbflowgrades) {
        const flowgrade = models.sanitise(models.flowgrades, dbflowgrade)
        flowgrade.scores = models.sanitiselist(await dbflowgrade.getFlowgradescores(), models.flowgradescores)
        flow.flowgrades.push(flowgrade)
      }

      const dbpub = await dbflow.getPub()
      if (!dbpub) return utils.giveup(req, res, "pub not found")
      const pub = models.sanitise(models.pubs, dbpub)

      // Get my roles in all publications
      const dbmypubroles = await req.dbuser.getRoles()

      // Set isowner and myroles for this publication
      let isowner = false
      const myroles = []
      _.forEach(dbmypubroles, (dbmypubrole) => {
        if (dbmypubrole.pubId === pub.id) {
          const mypubrole = models.sanitise(models.pubroles, dbmypubrole)
          myroles.push(mypubrole)
          if (mypubrole.isowner) isowner = true
        }
      })

      // Get submit's statuses and currentstatus
      const dbstatuses = await req.dbsubmit.getStatuses({ order: [['id', 'DESC']] })
      submit.statuses = []
      let currentstatus = false
      for (const dbstatus of dbstatuses) {
        const submitstatus = models.sanitise(models.submitstatuses, dbstatus)
        submit.statuses.push(submitstatus)
        if (!currentstatus) currentstatus = submitstatus
      }
      if (!currentstatus) { // If no statuses, then give up here
        return utils.giveup(req, res, "No statuses for this submit")
      }


      ////////// What if owner???
      ////////// Filter submits
      let includethissubmit = false // ARGHH DUPLICATE CODE: SIMILAR SUB SLIMMED DOWN

      // Go through grades looking to see if currentstatus means that I need to grade
      for (const flowgrade of flow.flowgrades) {
        if (flowgrade.flowstatusId === currentstatus.flowstatusId) { // If we are at status where this grade possible
          //console.log('flowgrade', submit.id, flowgrade.id, flowgrade.name, flowgrade.visibletorole, flowgrade.visibletoreviewers)
          if (flowgrade.visibletorole !== 0) {
            // Check if I have role that means I can grade
            const ihavethisrole = _.find(myroles, roles => { return roles.id === flowgrade.visibletorole })
            if (ihavethisrole) {
              includethissubmit = true
              iamgrading = true
            }
          }
          if (flowgrade.visibletoreviewers) {
            // Check if I am reviewer that means I can grade
            const dbreviewers = await req.dbsubmit.getReviewers()
            for (const dbreviewer of dbreviewers) {
              if (dbreviewer.userId === req.dbuser.id) {
                includethissubmit = true
                iamgrading = true
              }
            }
          }
        }
      }
      if (!includethissubmit) {
        return utils.giveup(req, res, 'Not your submit entry')
      }
    }

    const entry = models.sanitise(models.entries, dbentry)
    
    await getEntryFormFields(entry, dbentry.flowstageId)

    entry.values = []
    for (const dbentryvalue of await dbentry.getEntryValues()) {
      const entryvalue = models.sanitise(models.entryvalues, dbentryvalue)
      if (iamgrading) {
        const field = _.find(entry.fields, field => { return field.id === entryvalue.formfieldId })
        if (field.hidewhengrading) continue
      }
      entry.values.push(entryvalue)
    }

    //console.log('entry', entry)
    logger.log4req(req, 'Returning entry', entryid)
    utils.returnOK(req, res, entry, 'entry')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* GET formfields for specified flowstageId */
router.get('/submits/formfields/:flowstageId', async function (req, res, next) {
  try {
    const flowstageId = parseInt(req.params.flowstageId)
    console.log('GET /submits/formfields/', flowstageId, req.dbuser.id)

    if (!Number.isInteger(req.dbuser.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const entry = {}
    await getEntryFormFields(entry, flowstageId)

    //console.log('entry', entry)
    logger.log4req(req, 'Returning formfields', flowstageId)
    utils.returnOK(req, res, entry, 'entry')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* Retrive formfields for entry
 * entry may be existing or newly created
 */
async function getEntryFormFields(entry, flowstageId) {
  const dbformfields = await models.formfields.findAll({
    where: {
      formtypeid: flowstageId
    },
    order: [
      ['weight', 'ASC']
    ]
  })
  entry.fields = models.sanitiselist(dbformfields, models.formfields)
  //????entry.publookups = []
  entry.pubrolelookups = []
  for (const dbformfield of dbformfields) {
    if (dbformfield.pubroleId != null) {
      const dbpubrole = await models.pubroles.findByPk(dbformfield.pubroleId)
      if (!dbpubrole) {
        console.log('formfield: pubroleId not found', pubroleId)
      } else {
        const dbusers = await dbpubrole.getUsers()
        const users = []
        for (const dbuser of dbusers) {
          users.push({ value: dbuser.id, text: dbuser.name })
        }
        entry.pubrolelookups.push({
          pubroleId: dbformfield.pubroleId,
          users
        })
      }
    }
  }
}

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
router.get('/submits/pub/:pubid', async function (req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /submits/pub/', pubid)

    // Get my roles in all publications
    const dbmypubroles = await req.dbuser.getRoles()

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Invalid pubs:id')

    // Set isowner, onlyanauthor and myroles for this publication
    let isowner = false
    let onlyanauthor = false
    const myroles = []
    _.forEach(dbmypubroles, (dbmypubrole) => {
      if (dbmypubrole.pubId === pubid) {
        const mypubrole = models.sanitise(models.pubroles, dbmypubrole)
        myroles.push(mypubrole)
        if (mypubrole.isowner) isowner = true
        if (mypubrole.defaultrole) onlyanauthor = true // ie author
      }
    })
    if (myroles.length >= 2) onlyanauthor = false
    else if (myroles.length === 0) onlyanauthor = true
    if (req.dbuser.super) {
      onlyanauthor = false
      isowner = true
    }

    //////////
    const dbflows = await dbpub.getFlows()
    const flows = []
    for (const dbflow of dbflows) {
      ////////// FOR THIS FLOW
      const flow = models.sanitise(models.flows, dbflow)

      // Get all grades for this flow
      const dbflowgrades = await dbflow.getFlowgrades()
      flow.flowgrades = []
      for (const dbflowgrade of dbflowgrades) {
        const flowgrade = models.sanitise(models.flowgrades, dbflowgrade)
        flowgrade.scores = models.sanitiselist(await dbflowgrade.getFlowgradescores(), models.flowgradescores)
        flow.flowgrades.push(flowgrade)
      }

      // Find all candidate submits ie just user's or all of them
      flow.submits = []
      let dbsubmits = false
      if (onlyanauthor) { // Just get mine
        dbsubmits = await dbflow.getSubmits({ where: { userId: req.dbuser.id } })
      } else { // Otherwise: det all submits and filter
        dbsubmits = await dbflow.getSubmits()
      }

      // Get all possible flow statuses
      const dbstatuses = await dbflow.getFlowStatuses({ order: [ ['weight', 'ASC'] ]})
      flow.statuses = models.sanitiselist(dbstatuses, models.flowstatuses)

      // Get 'acceptings' ie details of which flow stages are open
      flow.acceptings = models.sanitiselist(await dbflow.getFlowAcceptings(), models.flowacceptings)

      // Get all possible flow stages
      const dbstages = await dbflow.getFlowStages({ order: [ ['weight', 'ASC']]})
      flow.stages = models.sanitiselist(dbstages, models.flowstages)

      ////////// Set up flow-level actions that are possible
      flow.actions = [] // Allowable actions
      for (const accepting of flow.acceptings) {
        if (_.isNull(accepting.flowstatusId) && accepting.open) {
          const addstage = _.find(flow.stages, stage => { return stage.id === accepting.flowstageId })
          if (addstage) {
            flow.actions.push({
              name: 'Add ' + addstage.name,
              route: '/panel/' + pubid + '/' + flow.id + '/add/' + addstage.id
            })
          }
        }
      }

      ////////// GO THROUGH ALL FLOW'S SUBMITS
      for (const dbsubmit of dbsubmits) {
        const submit = models.sanitise(models.submits, dbsubmit)

        const dbsubmitgradings = await dbsubmit.getGradings()

        submit.actions = [] // Allowable actions

        // Get submit's statuses and currentstatus
        const dbstatuses = await dbsubmit.getStatuses({ order: [ ['id', 'DESC']]})
        submit.statuses = []
        let currentstatus = false
        for (const dbstatus of dbstatuses) {
          const submitstatus = models.sanitise(models.submitstatuses, dbstatus)
          const flowstatus = _.find(flow.statuses, flowstatus => { return flowstatus.id === submitstatus.flowstatusId })
          if (onlyanauthor && !flowstatus.visibletoauthor) continue // If author: only return statuses with visibletoauthor
          submit.statuses.push(submitstatus)
          if (!currentstatus) currentstatus = submitstatus
        }
        if (!currentstatus) { // If no statuses, then only return to owner
          if (!isowner) continue
        }

        submit.user = ''
        submit.ismine = true
        if (dbsubmit.userId !== req.dbuser.id) {
          const dbauthor = await dbsubmit.getUser()
          submit.user = dbauthor.name
          submit.ismine = false
        }

        ////////// If mine, then add actions to Add next stage (if appropriate)
        if (submit.ismine) {
          //console.log('currentstatus.flowstatusId', currentstatus.flowstatusId)
          if (currentstatus.flowstatusId) {
            const flowstatus = _.find(flow.statuses, (status) => { return status.id === currentstatus.flowstatusId })
            if (flowstatus) {
              //console.log('flowstatus.cansubmitflowstageId', flowstatus.cansubmitflowstageId)
              if (flowstatus.cansubmitflowstageId) {
                const stage = _.find(flow.stages, (stage) => { return stage.id === flowstatus.cansubmitflowstageId })
                if (stage) {
                  const route = '/panel/' + pubid + '/' + flow.id + '/' + submit.id + '/add/' + flowstatus.cansubmitflowstageId
                  submit.actions.push({ name: 'Add '+stage.name, route })
                }
              }
            }
          }
        }

        ////////// We'll need the entries (ordered by flowstage weight) so we can get action links
        const dbentries = await dbsubmit.getEntries({
          include: { model: models.flowstages },
          order: [
            [models.flowstages, 'weight', 'ASC'],
          ]
        })
        submit.entries = models.sanitiselist(dbentries, models.entries)

        ////////// Filter submits
        if (!onlyanauthor && !isowner) {
          let includethissubmit = false // ARGHH DUPLICATE CODE: SIMILAR CODE LATER

          // If user is the submitter, then include
          if (await req.dbuser.hasSubmit(dbsubmit)) {
            includethissubmit = true
          } // Don't else this

          // Go through grades looking to see if currentstatus means that I need to grade
          for (const flowgrade of flow.flowgrades) {

            // If I have already graded, don't add action later (but still show submit)
            let ihavegraded = false
            for (const dbsubmitgrading of dbsubmitgradings) {
              if ((flowgrade.id === dbsubmitgrading.flowgradeId) && (dbsubmitgrading.userId === req.dbuser.id)) {
                ihavegraded = true
              }
            }

            if (flowgrade.flowstatusId === currentstatus.flowstatusId) { // If we are at status where this grade possible
              //console.log('flowgrade', submit.id, flowgrade.id, flowgrade.name, flowgrade.visibletorole, flowgrade.visibletoreviewers)
              let route = false
              if (flowgrade.visibletorole !== 0) {
                // Check if I have role that means I can grade
                const ihavethisrole = _.find(myroles, roles => { return roles.id === flowgrade.visibletorole })
                if (ihavethisrole) {
                  includethissubmit = true
                  route = !ihavegraded
                }
              }
              if (flowgrade.visibletoreviewers) {
                // Check if I am reviewer that means I can grade
                const dbreviewers = await dbsubmit.getReviewers()
                for (const dbreviewer of dbreviewers) {
                  if (dbreviewer.userId === req.dbuser.id) {
                    includethissubmit = true
                    route = !ihavegraded
                  }
                }
              }
              if (route) {
                const entrytograde = _.find(submit.entries, (entry) => { return entry.flowstageId === flowgrade.displayflowstageId })
                if (entrytograde) {
                  route = '/panel/' + pubid + '/' + flow.id + '/' + submit.id + '/' + entrytograde.id
                  submit.actions.push({ name: flowgrade.name, route, flowgradeid: flowgrade.id })
                  submit.user = 'author redacted'
                }
              }
            }
          }
          if (!includethissubmit) continue
        }

        const reviewers = []
        for (const dbreviewer of await dbsubmit.getReviewers()) {
          const reviewer = models.sanitise(models.submitreviewers, dbreviewer)
          const dbuser = await dbreviewer.getUser()
          reviewer.username = dbuser ? dbuser.name : ''
          reviewers.push(reviewer)
        }
        const returnreviewers = true
        submit.reviewers = returnreviewers ? reviewers : []

        const returngradings = true
        submit.gradings = []
        if (returngradings) {
          for (const dbgrading of dbsubmitgradings) {
            const grading = models.sanitise(models.submitgradings, dbgrading)
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
            submit.gradings.push(grading)
          }
        }

        submit.actionable = submit.actions.length>0

        ////////// Add submit to return list
        flow.submits.push(submit)
      }

      //console.log('flow.actions', flow.actions)
      flows.push(flow)
    }

    logger.log4req(req, 'Returning flows', pubid)
    utils.returnOK(req, res, flows, 'flows')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* POST DELETE submit or PATCH submit title*/
router.post('/submits/:submitid', async function (req, res, next) {
  if (req.headers['x-http-method-override'] === 'PATCH') {
    await editSubmitTitle(req, res, next)
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
async function deleteSubmit(req, res, next) {
  try {
    //console.log('delete submit', req.params.submitid)

    const submitid = parseInt(req.params.submitid)
    req.dbsubmit = await models.submits.findByPk(submitid)
    if (!req.dbsubmit) return utils.giveup(req, res, "submit not found")

    const dbflow = await req.dbsubmit.getFlow()
    if (!dbflow) return utils.giveup(req, res, "flow not found")

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, "pub not found")

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    // Delete entries and their contents
    const dbentries = await req.dbsubmit.getEntries()
    for (const dbentry of dbentries) {
      req.entryid = dbentry.id
      const ok = await deleteEntry(req, res, next)
      if (!ok) return
    }

    // Delete statuses
    let affectedRows = await models.submitstatuses.destroy({ where: { submitId: submitid } })

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
/* PATCH edit submit title */
/* ACCESS: OWNER-ONLY TESTED */
async function editSubmitTitle(req, res, next) {
  try {
    console.log('changeSubmitTitle', req.params.submitid, req.body.newtitle)

    const submitid = parseInt(req.params.submitid)
    req.dbsubmit = await models.submits.findByPk(submitid)
    if (!req.dbsubmit) return utils.giveup(req, res, "submit not found")

    const dbflow = await req.dbsubmit.getFlow()
    if (!dbflow) return utils.giveup(req, res, "flow not found")

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, "pub not found")

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    req.dbsubmit.name = req.body.newtitle
    await req.dbsubmit.save()

    logger.log4req(req, 'Edited submit title', submitid, req.body.newtitle)

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
/* POST DELETE submit status*/
/* ACCESS: OWNER-ONLY TESTED */
async function deleteSubmitStatus(req, res, next) {
  try {
    //console.log('deleteSubmitStatus', req.params.id)

    const submitstatusid = parseInt(req.params.id)
    const dbsubmitstatus = await models.submitstatuses.findByPk(submitstatusid)
    if (!dbsubmitstatus) return utils.giveup(req, res, "submitstatus not found")

    req.dbsubmit = await dbsubmitstatus.getSubmit()
    if (!req.dbsubmit) return utils.giveup(req, res, "submit not found")

    const dbflow = await req.dbsubmit.getFlow()
    if (!dbflow) return utils.giveup(req, res, "flow not found")

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, "pub not found")

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

    const affectedRows = await models.submitstatuses.destroy({ where: { id: submitstatusid } })
    logger.log4req(req, 'Deleted submit status', submitstatusid, affectedRows)

    const ok = affectedRows === 1
    utils.returnOK(req, res, ok, 'ok')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
/* POST POST add submit status*/
/* ACCESS: OWNER-ONLY TESTED */
async function addSubmitStatus(req, res, next) {
  try {
    const submitid = parseInt(req.params.id)
    const newstatusid = parseInt(req.body.newstatusid)
    //console.log('addSubmitStatus', submitid, newstatusid)

    req.dbsubmit = await models.submits.findByPk(submitid)
    if (!req.dbsubmit) return utils.giveup(req, res, 'Submit not found')

    const dbflow = await req.dbsubmit.getFlow()
    if (!dbflow) return utils.giveup(req, res, "flow not found")

    const dbpub = await dbflow.getPub()
    if (!dbpub) return utils.giveup(req, res, "pub not found")

    // Get MY roles in all publications - check iamowner
    const dbmypubroles = await req.dbuser.getRoles()
    const iamowner = _.find(dbmypubroles, mypubrole => { return mypubrole.pubId === dbpub.id && mypubrole.isowner })
    if (!iamowner) return utils.giveup(req, res, 'Not an owner')

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
    await sendOutMailsForStatus(req, dbflowstatus, false)

    utils.returnOK(req, res, newsubmitstatus, 'submitstatus')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
}

/* ************************ */
// req.dbsubmit must be set
async function sendOutMailsForStatus(req, dbflowstatus, dbentry) {

  let dbformfields = false
  if (dbentry) {
    dbformfields = await models.formfields.findAll({ where: { formtypeid: dbentry.flowstageId } })
    if (!dbformfields) {
      logger.log4req(req, 'Could not find formfields so not sending mails', dbentry.flowstageId)
      return
    }
  }

  const dbmailrules = await dbflowstatus.getFlowMailRules()
  for (const dbmailrule of dbmailrules) {
    //console.log('sendOutMailsForStatus dbmailrule', dbmailrule.id, dbmailrule.flowmailtemplateId, dbmailrule.flowstatusId, dbmailrule.name, dbmailrule.sendToAuthor, dbmailrule.bccToOwners)

    const bccOwners = []
    if (dbmailrule.bccToOwners) {
      const dbflow = await req.dbsubmit.getFlow()
      if (!dbflow) {
        logger.log4req(req, 'Could not find flow so not sending mails')
        return
      }
      const dbpub = await dbflow.getPub()
      if (!dbpub) {
        logger.log4req(req, 'Could not find pub so not sending mails')
        return
      }
      const dbownerroles = await dbpub.getPubroles({ where: { isowner: true } })
      for (const dbownerrole of dbownerroles) {
        const dbownerusers = await dbownerrole.getUsers()
        for (const dbowneruser of dbownerusers) {
          bccOwners.push(dbowneruser.email)
        }
      }
    }

    if (dbmailrule.sendToAuthor) {
      const dbtemplate = await dbmailrule.getFlowmailtemplate()
      //console.log('sendOutMailsForStatus dbtemplate', dbtemplate.id, dbtemplate.name, dbtemplate.subject)
      const dbauthor = await req.dbsubmit.getUser()
      if (dbauthor) {
        //console.log('dbauthor', dbauthor.id, dbauthor.email)
        let subject = Handlebars.compile(dbtemplate.subject)
        let body = Handlebars.compile(dbtemplate.body)

        let entryout = false
        if (dbentry) {
          entryout = models.sanitise(models.entries, dbentry)
          for (const sv of req.body.values) {
            const v = JSON.parse(sv)

            const formfield = _.find(dbformfields, formfield => { return formfield.id === v.formfieldid })

            let stringvalue = ''
            if (v.string) stringvalue = v.string
            else if (v.text) stringvalue = v.text
            else if (v.integer) stringvalue = v.integer.toString()
            else if (v.file) stringvalue = v.file

            if (formfield) {
              if (formfield.type === 'yes' || formfield.type === 'yesno') {
                stringvalue = v.integer ? 'Yes' : 'No'
              } else if (formfield.type === 'lookup' || formfield.type === 'lookups') {
                stringvalue = ''
                const aselections = v.string.split(',')
                for (const sel of aselections) {
                  const dbpublookupvalue = await models.publookupvalues.findByPk(parseInt(sel))
                  if (dbpublookupvalue) {
                    stringvalue += dbpublookupvalue.text + ' - '
                  } else {
                    stringvalue += sel + ' - '
                  }
                }
              } else if (formfield.type === 'rolelookups') {
                stringvalue = ''
                const aselections = v.string.split(',')
                for (const sel of aselections) {
                  const dbuser = await models.users.findByPk(parseInt(sel))
                  if (dbuser) {
                    stringvalue += dbuser.name + ' - '
                  } else {
                    stringvalue += sel + ' - '
                  }
                }
              }
            }

            entryout['field_' + v.formfieldid] = stringvalue
          }
        }

        const now = (new Date()).toLocaleString()
        const data = {
          submit: models.sanitise(models.submits, req.dbsubmit),
          entry: entryout,
          user: models.sanitise(models.users, dbauthor),
          now,
        }
        subject = subject(data)
        body = body(data)
        utils.async_mail(dbauthor.email, subject, body, bccOwners.join(','))
      }
    }
  }
}

module.exports = router
