const fs = require('fs')
const path = require('path')
const _ = require('lodash/core')

const name = 'Add simple flow'

const roleDefaults = { isowner: false, canviewall:false, defaultrole: false, isreviewer:false, userRequested:false, userDeniedAccess:false }

const statusDefaults = { visibletoauthor: false, ended: false, submittedflowstageId: null, cansubmitflowstageId: null, owneradvice: '' }

const gradeDefaults = { visibletorole: false, visibletoreviewers: false, cancomment: false, canopttoreview: false, authorcanseeatthesestatuses: '', helptext: '', helplinktext: '', helplink: '' }

function lookup(lookfor, lookin) {
  if (lookfor) {
    const thing = _.find(lookin, thing => { return thing.name === lookfor })
    if (thing) {
      return thing.db.id
    }
  }
  return null
}

async function runscript(models, configfilename, rv) {
  if (!rv) rv = {}

  try {
    let configtext = fs.readFileSync(path.resolve(__dirname, configfilename), { encoding: 'utf8' })
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
      config = JSON.parse(configtext)
    } catch (e) {
      console.error('config file not in JSON format')
      return 0
    }
    //console.log(config)

    console.log('PROCESSING:', config.name)
    if (config.pub) {
      const newpub = { siteId: 1, startdate: new Date(2021, 1, 1, 0, 0, 0, 0), ...config.pub }
      config.pub.db = await models.pubs.create(newpub)
      if (!config.pub.db) return 'Could not create pub'
      console.log('pub created', config.pub.db.id)

      for (const role of config.pub.role) {
        const newrole = { pubId: config.pub.db.id, ...roleDefaults, ...role }
        role.db = await models.pubroles.create(newrole)
        if (!role.db) return 'Could not create role'+role.name
        console.log('role.db created', role.name, role.db.id)
      }
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

      for (const flow of config.pub.flow) {
        const newflow = { pubId: config.pub.db.id, ...flow }
        flow.db = await models.flows.create(newflow)
        if (!flow.db) return 'Could not create flow'
        console.log('flow created', flow.db.id)

        for (const stage of flow.stage) {
          stage.pubroleId = lookup(stage.role, config.pub.role)
          const newstage = { flowId: flow.db.id, ...stage }
          stage.db = await models.flowstages.create(newstage)
          if (!stage.db) return 'Could not create stage' + stage.name
          console.log('stage.db created', stage.name, stage.db.id)
        }

        let weight = 1
        for (const status of flow.status) {
          status.submittedflowstageId = lookup(status.submittedflowstage, flow.stage)
          status.cansubmitflowstageId = lookup(status.cansubmitflowstage, flow.stage)
          const newstatus = { flowId: flow.db.id, ...statusDefaults, ...status, status: status.name, weight: weight++ }
          status.db = await models.flowstatuses.create(newstatus)
          if (!status.db) return 'Could not create status' + status.name
          console.log('status.db created', status.name, status.db.id)
        }

        for (const grade of flow.grade) {
          grade.flowstatusId = lookup(grade.flowstatus, flow.status)
          grade.displayflowstageId = lookup(grade.displayflowstage, flow.stage)
          grade.visibletorole = lookup(grade.visibletorole, config.pub.role)
          if (grade.visibletorole === null) grade.visibletorole = 0
          const newgrade = { flowId: flow.db.id, ...gradeDefaults, ...grade }
          grade.db = await models.flowgrades.create(newgrade)
          if (!grade.db) return 'Could not create grade' + grade.name
          console.log('grade.db created', grade.name, grade.db.id)

          // NOW ADD GRADE SCORES
          for (const score of grade.score) {
            /*const newflowgradeProposalReject = {
              flowgradeId: rv.grade.proposal.id,
              weight: 20,
              name: 'Reject'
            }
            rv.grade.score.proposalReject = await models.flowgradescores.create(newflowgradeProposalReject)
            if (!rv.grade.score.proposalReject) return 'Could not create flowgrade.score.proposalReject'
            console.log('flowgrade.score.proposalReject created', rv.grade.score.proposalReject.id)*/
          }
        }
      }
      // Form fields
      for (const formfield of config.pub.formfield) {
        /*const newformfieldName = {
          pubId: rv.pub.id,
          formtype: 2,
          formtypeid: rv.stage.proposal.id,
          label: 'Name',
          help: 'Please enter your name',
          helplink: '',
          weight: 10,
          type: 'string',
          publookupid: null,
          pubroleId: null,
          required: true,
          requiredif: '',
          allowedfiletypes: '',
          maxwords: null,
          maxchars: null,
          hideatgrading: 1,
          includeindownload: 1
        }
        rv.formfield.name = await models.formfields.create(newformfieldName)
        if (!rv.formfield.name) return 'Could not create formfield.name'
        console.log('formfield.name created', rv.formfield.name.id)*/
      }
    }
  } catch (e) {
    return e.message
  }
}

module.exports = {
  name,
  runscript
}
