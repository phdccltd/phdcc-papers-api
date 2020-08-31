const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const Handlebars = require("handlebars")
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
    const dbflowstage = await models.flowstages.findByPk(req.body.stageid)
    if (!dbflowstage) return utils.giveup(req, res, 'flowstageid not found: ' + req.body.stageid)

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

      const dbmailrules = await dbflowstatus.getFlowMailRules()
      for (const dbmailrule of dbmailrules) {
        //console.log('addEntry dbmailrule', dbmailrule.id, dbmailrule.flowmailtemplateId, dbmailrule.flowstatusId, dbmailrule.name, dbmailrule.sendToAuthor)
        if (dbmailrule.sendToAuthor) {
          const dbtemplate = await dbmailrule.getFlowmailtemplate()
          //console.log('addEntry dbtemplate', dbtemplate.id, dbtemplate.name, dbtemplate.subject, dbtemplate.bcc)
          const dbauthor = await req.dbsubmit.getUser()
          if (dbauthor) {
            //console.log('dbauthor', dbauthor.id, dbauthor.email)
            let subject = Handlebars.compile(dbtemplate.subject)
            let body = Handlebars.compile(dbtemplate.body)

            const entryout = models.sanitise(models.entries, dbentry)
            for (const sv of req.body.values) {
              const v = JSON.parse(sv)
              let stringvalue = ''
              if (v.string) stringvalue = v.string
              else if (v.text) stringvalue = v.text
              else if (v.integer) stringvalue = v.integer.toString()
              else if (v.file) stringvalue = v.file
              entryout['field_' + v.formfieldid] = stringvalue
            }
            console.log('entryout', entryout)

            const now = (new Date()).toLocaleString()
            const data = {
              submit: models.sanitise(models.submits, req.dbsubmit),
              entry: entryout,
              user: models.sanitise(models.users, dbauthor),
              now,
            }
            subject = subject(data)
            body = body(data)
            utils.async_mail(dbauthor.email, subject, body, dbtemplate.bcc)
          }
        }
      }
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
      userId: req.user.id,
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
    console.log('GET /submits/entry/ file', entryid, entryvalueid, req.user.id)
    if (!Number.isInteger(req.user.id)) return utils.giveup(req, res, 'Invalid req.user.id')

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
    console.log('GET /submits/entry/', entryid, req.user.id)

    if (!Number.isInteger(req.user.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const dbentry = await models.entries.findByPk(entryid)
    if (!dbentry) return utils.giveup(req, res, 'Invalid entryid')

    const dbsubmit = await models.submits.findByPk(dbentry.submitId)
    if (!dbsubmit) return utils.giveup(req, res, 'No submit for entryid')

    if (dbsubmit.userId !== req.user.id) return utils.giveup(req, res, 'Not your submit entry')

    const entry = models.sanitise(models.entries, dbentry)
    
    const dbentryvalues = await dbentry.getEntryValues()
    entry.values = []
    for (const dbentryvalue of dbentryvalues) {
      const entryvalue = models.sanitise(models.entryvalues, dbentryvalue)
      entry.values.push(entryvalue)
    }

    const dbformfields = await models.formfields.findAll({
      where: {
        formtypeid: dbentry.flowstageId
      },
      order: [
        ['weight', 'ASC']
      ]
    })
    entry.fields = []
    entry.publookups = []
    for (const dbformfield of dbformfields) {
      const formfield = models.sanitise(models.formfields, dbformfield)
      entry.fields.push(formfield)
    }

    //console.log('entry', entry)
    logger.log4req(req, 'Returning entry', entryid)
    utils.returnOK(req, res, entry, 'entry')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* GET formfields for specified flowstageId*/
router.get('/submits/formfields/:flowstageId', async function (req, res, next) {
  try {
    const flowstageId = parseInt(req.params.flowstageId)
    console.log('GET /submits/formfields/', flowstageId, req.user.id)

    if (!Number.isInteger(req.user.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const entry = {}
    const dbformfields = await models.formfields.findAll({
      where: {
        formtypeid: flowstageId
      },
      order: [
        ['weight', 'ASC']
      ]
    })
    entry.fields = []
    entry.publookups = []
    for (const dbformfield of dbformfields) {
      const formfield = models.sanitise(models.formfields, dbformfield)
      entry.fields.push(formfield)
    }

    //console.log('entry', entry)
    logger.log4req(req, 'Returning formfields', flowstageId)
    utils.returnOK(req, res, entry, 'entry')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})

/* ************************ */
/* GET submits for publication. */
router.get('/submits/pub/:pubid', async function (req, res, next) {
  try {
    const pubid = parseInt(req.params.pubid)
    console.log('GET /submits/pub/', pubid, req.user.id)

    if (!Number.isInteger(req.user.id)) return utils.giveup(req, res, 'Invalid req.user.id')

    const dbpub = await models.pubs.findByPk(pubid)
    if (!dbpub) return utils.giveup(req, res, 'Invalid pubs:id')

    const dbflows = await dbpub.getFlows()
    const flows = []
    for (const dbflow of dbflows) {
      const flow = models.sanitise(models.flows, dbflow)
      flow.submits = []
      const dbsubmits = await dbflow.getSubmits({
        where: {
          userId: req.user.id
        }
      })
      flow.statuses = []
      const dbstatuses = await dbflow.getFlowStatuses({
        order: [
          ['weight', 'ASC']
        ]
      })
      for (const dbstatus of dbstatuses) {
        flow.statuses.push(models.sanitise(models.flowstatuses, dbstatus))
      }
      flow.acceptings = []
      const dbacceptings = await dbflow.getFlowAcceptings()
      for (const dbaccepting of dbacceptings) {
        flow.acceptings.push(models.sanitise(models.flowacceptings, dbaccepting))
      }
      flow.stages = []
      const dbstages = await dbflow.getFlowStages({
        order: [
          ['weight', 'ASC']
        ]
      })
      for (const dbstage of dbstages) {
        flow.stages.push(models.sanitise(models.flowstages, dbstage))
      }
      for (const dbsubmit of dbsubmits) {
        const submit = models.sanitise(models.submits, dbsubmit)
        const dbentries = await dbsubmit.getEntries({
          include: { model: models.flowstages },
          order: [
            [models.flowstages, 'weight', 'ASC'],
          ]
        })
        submit.entries = []
        for (const dbentry of dbentries) {
          submit.entries.push(models.sanitise(models.entries, dbentry))
        }

        // TODO: Only return ones with visibletoauthor set to author
        const dbstatuses = await dbsubmit.getStatuses({
          order: [
            ['id', 'DESC']
          ]
        })
        submit.statuses = []
        for (const dbstatus of dbstatuses) {
          submit.statuses.push(models.sanitise(models.submitstatuses, dbstatus))
        }

        flow.submits.push(submit)
      }
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
async function deleteSubmit(req, res, next) {
  try {
    //console.log('delete submit', req.params.submitid)

    const submitid = parseInt(req.params.submitid)
    const dbsubmit = await models.submits.findByPk(submitid)
    if (!dbsubmit) return utils.giveup(req, res, "submit not found")

    // Delete entries and their contents
    const dbentries = await dbsubmit.getEntries()
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
async function editSubmitTitle(req, res, next) {
  try {
    console.log('changeSubmitTitle', req.params.submitid, req.body.newtitle)

    const submitid = parseInt(req.params.submitid)
    const dbsubmit = await models.submits.findByPk(submitid)
    if (!dbsubmit) return utils.giveup(req, res, "submit not found")

    dbsubmit.name = req.body.newtitle
    await dbsubmit.save()

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
async function deleteSubmitStatus(req, res, next) {
  console.log('deleteSubmitStatus', req.params.id)

  const submitstatusid = parseInt(req.params.id)
  const dbsubmitstatus = await models.submitstatuses.findByPk(submitstatusid)
  if (!dbsubmitstatus) return utils.giveup(req, res, "submitstatus not found")

  const affectedRows = await models.submitstatuses.destroy({ where: { id: submitstatusid } })
  logger.log4req(req, 'Deleted submit status', submitstatusid, affectedRows)

  const ok = affectedRows === 1
  utils.returnOK(req, res, ok, 'ok')
}

/* ************************ */
/* POST POST add submit status*/
async function addSubmitStatus(req, res, next) {
  const submitid = parseInt(req.params.id)
  const newstatusid = parseInt(req.body.newstatusid)
  console.log('addSubmitStatus', submitid, newstatusid)

  const dbsubmit = await models.submits.findByPk(submitid)
  if (!dbsubmit) return utils.giveup(req, res, 'Submit not found')

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

  utils.returnOK(req, res, newsubmitstatus, 'submitstatus')
}

/* ************************ */

/* GET submit by ID.
router.get('/submits/:id', async function (req, res, next) {
  // TODO: Check access - is user allowed to access this submission?
  const id = parseInt(req.params.id)
  console.log('GET /submits', id)
  const dbsubmit = await models.submits.findByPk(id)
  if (dbsubmit) {
    const submit = models.sanitise(models.submits, dbsubmit)
    utils.returnOK(req, res, submit, 'submit')
  } else {
    utils.giveup(req, res, 'Invalid submits:id')
  }
})*/

/*
app.get('/', (req, res) => {
  return res.send('Received a GET HTTP method')
})

app.post('/', (req, res) => {
  return res.send('Received a POST HTTP method')
})

app.put('/', (req, res) => {
  return res.send('Received a PUT HTTP method')
})

app.delete('/', (req, res) => {
  return res.send('Received a DELETE HTTP method')
})
*/

module.exports = router
