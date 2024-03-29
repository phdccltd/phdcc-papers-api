// https://dev.to/nedsoft/testing-nodejs-express-api-with-jest-and-supertest-1km6
// https://www.npmjs.com/package/supertest
// https://visionmedia.github.io/superagent/
// https://stackoverflow.com/questions/31892295/trying-to-post-multipart-form-data-with-node-js-supertest

const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const request = require('supertest')
const bcrypt = require('bcrypt')
const saltRounds = 10

const name = 'Add simple flow'

const roleDefaults = { isowner: false, canviewall: false, defaultrole: false, isreviewer: false, userRequested: false, userDeniedAccess: false }

const statusDefaults = { visibletoauthor: false, ended: false, submittedflowstageId: null, cansubmitflowstageId: null, owneradvice: '' }

const gradeDefaults = { visibletorole: false, visibletoreviewers: false, cancomment: false, canopttoreview: false, authorcanseeatthesestatuses: '', helptext: '', helplinktext: '', helplink: '' }

const acceptingDefaults = { open: true }

const defaultFormfield = { formtype: 2, formtypeid: 1, help: '', helplink: '', required: true, requiredif: '', maxwords: 0, maxchars: 0, hideatgrading: 0, includeindownload: 1 }

const defaultPubMail = { flowstatusId: null, flowstageId: null, flowgradeId: null, sendReviewReminderDays: 0, sendLeadReminderDays: 0, sendReviewChaseUpDays: 0, sendOnSiteAction: 0, sendOnRoleGiven: 0, sendToAuthor: false, bccToOwners: false, sendToUser: false, sendToReviewers: false, pubroleId: null }

const defaultUser = { super: false, password: 'pwd' }

const persisted = {}

function lookup (lookfor, lookin) {
  if (lookfor) {
    const thing = _.find(lookin, _thing => { return _thing.name === lookfor })
    if (thing) {
      return thing.db.id
    } else throw new Error('Unrecognised lookup: ' + lookfor)
  }
  return null
}

async function run (models, configfilename, existingconfig, app, resBody, resCallback) {
  if (!existingconfig) existingconfig = {}

  try {
    /// //////////////////////
    const configfile = path.resolve(__dirname, '../scripts', configfilename)
    let configtext = fs.readFileSync(configfile, { encoding: 'utf8' })
    if (configtext.charCodeAt(0) === 65279) { // Remove UTF-8 start character
      configtext = configtext.slice(1)
    }
    while (true) {
      const dslashpos = configtext.indexOf('//')
      if (dslashpos === -1) break
      const endlinepos = configtext.indexOf('\n', dslashpos)
      if (endlinepos === -1) {
        configtext = configtext.substring(0, dslashpos)
        break
      }
      configtext = configtext.substring(0, dslashpos) + configtext.substring(endlinepos)
    }

    let config
    try {
      config = JSON.parse(configtext)
    } catch (e) {
      return 'config file not in JSON format'
    }

    console.log('----')
    console.log('PROCESSING:', configfilename, config.name)
    let weight
    // Publication: just one per config
    /// //////////////////////
    if (config.pub) {
      console.log('----')
      const newpub = { siteId: 1, startdate: new Date(2021, 1, 1, 0, 0, 0, 0), ...config.pub }
      config.pub.db = await models.pubs.create(newpub)
      if (!config.pub.db) return 'Could not create pub'
      console.log('pub created', config.pub.db.id)

      // Publication roles
      for (const role of config.pub.role) {
        const newrole = { pubId: config.pub.db.id, ...roleDefaults, ...role }
        role.db = await models.pubroles.create(newrole)
        if (!role.db) return 'Could not create role' + role.name
        console.log('role.db created', role.name, role.db.id)
      }

      // Publication lookups
      weight = 1
      for (const publookup of config.pub.publookup) {
        const newpublookup = { pubId: config.pub.db.id, ...publookup }
        publookup.db = await models.publookups.create(newpublookup)
        if (!publookup.db) return 'Could not create publookup' + publookup.name
        console.log('publookup.db created', publookup.name, publookup.db.id)

        for (const value of publookup.value) {
          const newvalue = { publookupId: publookup.db.id, ...value, weight: weight++ }
          value.db = await models.publookupvalues.create(newvalue)
          if (!value.db) return 'Could not create publookupvalue' + value.text
          console.log('value.db created', value.text, value.db.id)
        }
      }

      // Flow and its components
      for (const flow of config.pub.flow) {
        const newflow = { pubId: config.pub.db.id, ...flow }
        flow.db = await models.flows.create(newflow)
        if (!flow.db) return 'Could not create flow'
        console.log('flow created', flow.db.id)

        // Flow stages
        weight = 1
        for (const stage of flow.stage) {
          stage.pubroleId = lookup(stage.role, config.pub.role)
          const newstage = { flowId: flow.db.id, ...stage, weight: weight++ }
          stage.db = await models.flowstages.create(newstage)
          if (!stage.db) return 'Could not create stage' + stage.name
          console.log('stage.db created', stage.name, stage.db.id)
        }

        // Flow statuses
        weight = 1
        for (const status of flow.status) {
          status.submittedflowstageId = lookup(status.submittedflowstage, flow.stage)
          status.cansubmitflowstageId = lookup(status.cansubmitflowstage, flow.stage)
          const newstatus = { flowId: flow.db.id, ...statusDefaults, ...status, status: status.name, weight: weight++ }
          status.db = await models.flowstatuses.create(newstatus)
          if (!status.db) return 'Could not create status ' + status.name
          console.log('status.db created', status.name, status.db.id)
        }

        // Flow grades
        for (const grade of flow.grade) {
          grade.flowstatusId = lookup(grade.flowstatus, flow.status)
          grade.displayflowstageId = lookup(grade.displayflowstage, flow.stage)
          grade.visibletorole = lookup(grade.visibletorole, config.pub.role)
          if (grade.visibletorole === null) grade.visibletorole = 0

          if (grade.authorcanseeatthesestatuses) {
            const stati = grade.authorcanseeatthesestatuses.split(',')
            grade.authorcanseeatthesestatuses = ''
            for (const statustext of stati) {
              const matchstatus = _.find(flow.status, status => { return status.name === statustext })
              if (matchstatus) {
                if (grade.authorcanseeatthesestatuses.length > 0) grade.authorcanseeatthesestatuses += ','
                grade.authorcanseeatthesestatuses += matchstatus.db.id
              } else {
                return 'Not found status ' + statustext + ' for grade: ' + grade.name
              }
            }
          }

          const newgrade = { flowId: flow.db.id, ...gradeDefaults, ...grade }
          grade.db = await models.flowgrades.create(newgrade)
          if (!grade.db) return 'Could not create grade' + grade.name
          console.log('grade.db created', grade.name, grade.db.id)

          weight = 1
          for (const score of grade.score) {
            const newscore = {
              flowgradeId: grade.db.id,
              weight,
              name: score.name
            }
            score.db = await models.flowgradescores.create(newscore)
            if (!score.db) return 'Could not create score ' + score.name
            console.log('score.db created', score.db.id)
          }
        }

        // Flow acceptings
        for (const accepting of flow.accepting) {
          accepting.flowstageId = lookup(accepting.flowstage, flow.stage)
          accepting.flowstatusId = lookup(accepting.flowstatus, flow.status)
          const newaccepting = { flowId: flow.db.id, ...acceptingDefaults, ...accepting }
          accepting.db = await models.flowacceptings.create(newaccepting)
          if (!accepting.db) return 'Could not create accepting' + accepting.flowstage
          console.log('accepting.db created', accepting.flowstage, accepting.db.id)
        }
      } // End of flow

      // Form fields
      weight = 1
      const refs = []
      config.pub.formfield = config.pub.formfield || []
      for (const formfield of config.pub.formfield) {
        for (const flow of config.pub.flow) {
          const foundid = lookup(formfield.flowstage, flow.stage)
          if (foundid) formfield.formtypeid = foundid
          if (formfield.hideatgradingname) {
            const foundhideatgrading = lookup(formfield.hideatgradingname, flow.grade)
            if (foundhideatgrading) formfield.hideatgrading = foundhideatgrading
          }
        }
        formfield.publookupId = lookup(formfield.publookup, config.pub.publookup)
        if (refs.length > 0 && 'requiredif' in formfield) { // eg @HasConflictOfInterest=1
          const requiredif = formfield.requiredif
          const atPos = requiredif.indexOf('@')
          if (atPos !== -1) {
            const endPos = requiredif.indexOf('=', atPos)
            const lookfor = requiredif.substring(atPos + 1, endPos)
            for (const ref of refs) {
              if (ref.name === lookfor) {
                formfield.requiredif = requiredif.substring(0, atPos) + ref.id + requiredif.substring(endPos)
              }
            }
          }
        }
        const newformfield = { formtype: 2, ...defaultFormfield, ...formfield, weight: weight++ }
        formfield.db = await models.formfields.create(newformfield)
        if (!formfield.db) return 'Could not create formfield'
        console.log('formfield.db created', formfield.db.id)
        if ('ref' in formfield) {
          const ref = { name: formfield.ref, id: formfield.db.id }
          refs.push(ref)
        }
      }
      // Publication mail templates
      weight = 1
      config.pub.pubmailtemplates = config.pub.pubmailtemplates || []
      for (const pubmail of config.pub.pubmailtemplates) {
        pubmail.sendOnRoleGiven = lookup(pubmail.sendOnRoleGiven, config.pub.role)
        if (pubmail.sendOnRoleGiven === null) pubmail.sendOnRoleGiven = 0
        pubmail.flowstageId = lookup(pubmail.flowstageId, config.pub.flow[0].stage)
        pubmail.flowstatusId = lookup(pubmail.flowstatusId, config.pub.flow[0].status)
        pubmail.flowgradeId = lookup(pubmail.flowgradeId, config.pub.flow[0].grade)
        pubmail.pubroleId = lookup(pubmail.pubroleId, config.pub.role)
        let pubid = config.pub.db.id
        if ('nullpub' in pubmail) {
          if ('sendOnSiteAction' in pubmail) {
            const existing = await models.pubmailtemplates.findOne({ where: { sendOnSiteAction: pubmail.sendOnSiteAction } })
            if (existing) continue // Skip if this site-wide template already exists
          }
          pubid = null
        }
        const newpubmail = { pubId: pubid, ...defaultPubMail, ...pubmail, weight: weight++ }
        // console.log('newpubmail', newpubmail)
        pubmail.db = await models.pubmailtemplates.create(newpubmail)
        if (!pubmail.db) return 'Could not create pubmail'
        // console.log('pubmail.db', pubmail.db)
        console.log('pubmail.db created', pubmail.db.id)
      }
    }
    /// //////////////////////
    // Add sitepages
    if (config.sitepages) {
      console.log('----')
      for (const sitepage of config.sitepages) {
        const newsitepage = { siteId: 1, ...sitepage }
        sitepage.db = await models.sitepages.create(newsitepage)
        if (!sitepage.db) return 'Could not create sitepage ' + sitepage.title
        console.log('sitepage.db created', sitepage.db.id)
      }
    }
    /// //////////////////////
    // Add users
    if (config.users) {
      console.log('----')
      const pub = config.pub ? config.pub : existingconfig.pub
      if (!pub) return 'No publication found to attach users to'
      if (pub.name !== config.pubname) return 'Users publication not found ' + config.pubname
      console.log('Adding users and with roles in publication ' + pub.name)
      for (const user of config.users) {
        const newuser = { ...defaultUser, ...user }
        newuser.password = await bcrypt.hash(newuser.password, saltRounds)
        user.db = await models.users.create(newuser)
        if (!user.db) return 'Could not create user ' + user.name
        console.log('user.db created', user.db.id)

        await pub.db.addUser(user.db)

        const roles = user.roles.split(',')
        for (const findrole of roles) {
          const matchrole = _.find(pub.role, role => { return role.name === findrole })
          if (matchrole) {
            await matchrole.db.addUser(user.db)
            console.log('Added role', findrole)
          } else {
            return 'Not found role ' + findrole + ' to user ' + user.name
          }
        }
      }
    }
    /// //////////////////////
    if (config.api) {
      for (const call of config.api) {
        const data = call.data || {}
        if (data && 'g-recaptcha-response' in data) {
          data['g-recaptcha-response'] = process.env.RECAPTCHA_BYPASS
        }
        if ('preset' in call) {
          for (const preset of call.preset) {
            if (preset.name in data) {
              const before = data[preset.name]
              const usepos = before.indexOf(preset.use)
              if (usepos !== -1) {
                const usename = preset.use.substring(1)
                const replaceby = usename in persisted ? persisted[usename] : ''
                const after = before.substring(0, usepos) + replaceby + before.substring(usepos + preset.use.length)
                data[preset.name] = after
                console.log('Preset ', preset.name, after)
              }
            }
          }
        }
        call.attachs = call.attachs || []
        call.fields = call.fields || []
        const authheader = 'token' in persisted ? 'bearer ' + persisted.token : ''

        console.log('Running ' + call.name + ': ' + call.method + ' ' + call.uri)
        let res = false
        switch (call.method) {
          case 'get':
            res = await request(app)
              .get(call.uri)
              .set('authorization', authheader)
              .set(data)
            break
          case 'post':
            res = await request(app)
              .post(call.uri)
              .set('authorization', authheader)
              .send(data)
            break
          case 'postdelete':
            res = await request(app)
              .post(call.uri)
              .set('x-http-method-override', 'DELETE')
              .set('authorization', authheader)
              .send(data)
            break
          case 'postpatch':
            res = await request(app)
              .post(call.uri)
              .set('x-http-method-override', 'PATCH')
              .set('authorization', authheader)
              .send(data)
            break
          case 'postpost':
            res = await request(app)
              .post(call.uri)
              .set('x-http-method-override', 'POST')
              .set('authorization', authheader)
              .send(data)
            break
          case 'postput':
            res = await request(app)
              .post(call.uri)
              .set('x-http-method-override', 'PUT')
              .set('authorization', authheader)
              .send(data)
            break
          case 'postputform': {
            let req = request(app)
              .post(call.uri)
              .set('x-http-method-override', 'PUT')
              .set('authorization', authheader)

            for (const attach of call.attachs) {
              req = req.attach('files', attach.path, attach.name)
            }

            for (const field of call.fields) {
              const fieldkeys = Object.keys(field)
              const fieldvalue = fieldkeys[0]
              req = req.field(fieldvalue, JSON.stringify(field[fieldvalue]))
            }
            res = await req
            break
          }
          case 'postform': {
            let req = request(app)
              .post(call.uri)
              .set('authorization', authheader)

            for (const attach of call.attachs) {
              req = req.attach('files', attach.path, attach.name)
            }

            for (const field of call.fields) {
              const fieldkeys = Object.keys(field)
              const fieldvalue = fieldkeys[0]
              req = req.field(fieldvalue, JSON.stringify(field[fieldvalue]))
            }
            res = await req
            break
          }
          case 'delete':
            res = await request(app)
              .delete(call.uri)
              .set('authorization', authheader)
            break
          default:
            return 'Bad call method: ' + call.method
        }
        if (!res) return 'No response for: ' + call.name
        console.log('res.body', res.body)
        // console.log('res.headers', res.headers)
        if (resBody) resBody.body = res.body

        if (res.statusCode !== 200) {
          if (call.return && 'statusCode' in call.return) {
            if (call.return.statusCode !== res.statusCode) return 'Response ret ' + res.statusCode + ' when ' + call.return.statusCode + ' wanted for: ' + call.name
            if ('location' in call.return) {
              if (call.return.location !== res.headers.location) return 'Response location ' + res.headers.location + ' when ' + call.return.location + ' wanted for: ' + call.name
            }
            delete call.return
          } else {
            return 'Response statusCode ' + res.statusCode + ' returned for: ' + call.name
          }
        }

        if (call.return) {
          if ('content-type' in call.return) {
            const desiredContentType = call.return['content-type']
            if (!('content-type' in res.headers)) return 'content-type header missing in response for: ' + call.name
            const foundContentType = res.headers['content-type']
            if (desiredContentType !== foundContentType) return 'content-type header incorrect \'' + foundContentType + '\' in response for: ' + call.name
          } else if ('ret' in call.return) {
            if (res.body.ret !== call.return.ret) return 'Response ret ' + res.body.ret + ' does not match ' + call.return.ret + ' for: ' + call.name
          } else {
            if (res.body.ret !== 0) return 'Response ret ' + res.body.ret + ' not zero  for: ' + call.name
          }
          if ('content-length' in call.return) {
            const desiredContentLength = call.return['content-length']
            if (!('content-length' in res.headers)) return 'content-length header missing in response for: ' + call.name
            const foundContentLength = parseInt(res.headers['content-length'])
            console.log('foundContentLength', foundContentLength)
            if (typeof desiredContentLength === 'string') {
              const afromto = desiredContentLength.split('-')
              if (afromto.length !== 2) return 'desired content-length duff: ' + desiredContentLength
              const min = parseInt(afromto[0])
              const max = parseInt(afromto[1])
              if (foundContentLength < min || foundContentLength > max) return 'content-length header incorrect \'' + foundContentLength + '\' in response for: ' + call.name
            } else if (desiredContentLength !== foundContentLength) return 'content-length header incorrect \'' + foundContentLength + '\' in response for: ' + call.name
          }
          if ('prop' in call.return) {
            if (Array.isArray(call.return.prop)) {
              for (const test of call.return.prop) {
                const prop = res.body[test.name]
                if (!(_.isEqual(prop, test.value))) return 'Prop \'' + test.name + '\' does not match: \'' + test.value + '\''
              }
            } else {
              // Cope with name and object.name
              const dotpos = call.return.prop.indexOf('.')
              let prop
              if (dotpos !== -1) {
                prop = res.body[call.return.prop.substring(0, dotpos)]
                if (prop) prop = prop[call.return.prop.substring(dotpos + 1)]
              } else {
                prop = res.body[call.return.prop]
              }
              if ('typeof' in call.return) {
                if (typeof prop !== call.return.typeof) return 'Prop \'' + call.return.prop + '\' with value \'' + prop + '\' not type \'' + call.return.typeof + '\' for: ' + call.name // eslint-disable-line valid-typeof
              }
              if ('value' in call.return) {
                if (prop !== call.return.value) return 'Prop \'' + call.return.prop + '\' with value \'' + prop + '\' not \'' + call.return.value + '\' for: ' + call.name
              }
              if ('length' in call.return) {
                if (prop.length !== call.return.length) return 'Prop \'' + call.return.prop + '\' with array length \'' + prop.length + '\' not \'' + call.return.length + '\' for: ' + call.name
              }
            }
          }
        }
        if (resCallback) {
          const callbackError = resCallback(res)
          if (callbackError) return callbackError + ' for: ' + call.name
        }
        if ('set' in call) {
          const dotpos = call.set.value.indexOf('.')
          let propvalue = call.set.value
          if (dotpos !== -1) {
            propvalue = res.body[call.set.value.substring(0, dotpos)]
            if (propvalue) propvalue = propvalue[call.set.value.substring(dotpos + 1)]
          } else {
            propvalue = res.body[call.set.value]
          }
          persisted[call.set.name] = propvalue
          console.log('Persisted ' + call.set.name + ' set to ' + persisted[call.set.name])
        }
      }
    }

    /// //////////////////////
    // Copy new config into existing
    Object.assign(existingconfig, config)
  } catch (e) {
    console.log('RUNSCRIPT EXCEPTION', e)
    return e.message
  }
}

module.exports = {
  name,
  run
}
