const fs = require('fs')
const path = require('path')
const _ = require('lodash/core')

const name = 'Add simple flow'

const roleDefaults = { isowner: false, canviewall: false, defaultrole: false, isreviewer: false, userRequested: false, userDeniedAccess: false }

const statusDefaults = { visibletoauthor: false, ended: false, submittedflowstageId: null, cansubmitflowstageId: null, owneradvice: '' }

const gradeDefaults = { visibletorole: false, visibletoreviewers: false, cancomment: false, canopttoreview: false, authorcanseeatthesestatuses: '', helptext: '', helplinktext: '', helplink: '' }

const acceptingDefaults = { open: true }

const defaultFormfield = { formtype: 2, formtypeid: 1, help: '', helplink: '', required: true, requiredif: '', maxwords: 0, maxchars: 0, hideatgrading: 0, includeindownload: 1 }

function lookup (lookfor, lookin) {
  if (lookfor) {
    const thing = _.find(lookin, thing => { return thing.name === lookfor })
    if (thing) {
      return thing.db.id
    }
  }
  return null
}

async function run(models, configfilename, config) {
  if (!config) config = {}

  try {
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
    // console.log(configtext)
    try {
      Object.assign(config, JSON.parse(configtext)) // Copy into config
    } catch (e) {
      console.error('config file not in JSON format')
      return 0
    }
    // console.log(config)

    console.log('PROCESSING:', config.name)
    let weight
    // Publication: just one per config
    if (config.pub) {
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
      for (const publookup of config.pub.publookup) {
        const newpublookup = { pubId: config.pub.db.id, ...publookup }
        publookup.db = await models.publookups.create(newpublookup)
        if (!publookup.db) return 'Could not create publookup' + publookup.name
        console.log('publookup.db created', publookup.name, publookup.db.id)

        for (const value of publookup.value) {
          const newvalue = { publookupId: publookup.db.id, ...value }
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
              weight: weight,
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
        const newformfield = { formtype: 2, ...defaultFormfield, ...formfield, weight: weight++ }
        formfield.db = await models.formfields.create(newformfield)
        if (!formfield.db) return 'Could not create formfield'
        console.log('formfield.db created', formfield.db.id)
      }
    }
  } catch (e) {
    return e.message
  }
}

module.exports = {
  name,
  run
}
