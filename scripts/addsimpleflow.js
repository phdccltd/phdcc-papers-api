const name = 'Add simple flow'

async function runscript (models, rv) {
  if (!rv) rv = {}
  console.log('ADD SIMPLE FLOW')

  try {
    // Publication
    const newpub = {
      siteId: 1,
      alias: 'TestPubAlias',
      name: 'TestPubName',
      title: 'Test Pub Title',
      description: 'Test Pub Description',
      startdate: new Date(2021, 1, 1, 0, 0, 0, 0),
      email: 'noreply@example.org',
      tz: 'Europe/London'
    }
    rv.pub = await models.pubs.create(newpub)
    if (!rv.pub) return 'Could not create pub'
    console.log('pub created', rv.pub.id)

    // Flow
    const newflow = {
      pubId: rv.pub.id,
      name: 'Paper',
      description: 'Proposal followed by Paper'
    }
    rv.flow = await models.flows.create(newflow)
    if (!rv.flow) return 'Could not create flow'
    console.log('flow created', rv.flow.id)

    // Publication roles
    rv.role = {}
    const newroleOwner = {
      pubId: rv.pub.id,
      name: 'Owner',
      isowner: true,
      canviewall: false,
      defaultrole: false,
      isreviewer: false,
      userRequested: false,
      userDeniedAccess: false
    }
    rv.role.owner = await models.pubroles.create(newroleOwner)
    if (!rv.role.owner) return 'Could not create role.owner'
    console.log('role.owner created', rv.role.owner.id)

    const newroleAuthor = {
      pubId: rv.pub.id,
      name: 'Author',
      isowner: false,
      canviewall: false,
      defaultrole: true,
      isreviewer: false,
      userRequested: false,
      userDeniedAccess: false
    }
    rv.role.author = await models.pubroles.create(newroleAuthor)
    if (!rv.role.author) return 'Could not create role.author'
    console.log('role.author created', rv.role.author.id)

    const newroleTeam = {
      pubId: rv.pub.id,
      name: 'Team',
      isowner: false,
      canviewall: true,
      defaultrole: false,
      isreviewer: false,
      userRequested: false,
      userDeniedAccess: false
    }
    rv.role.team = await models.pubroles.create(newroleTeam)
    if (!rv.role.team) return 'Could not create role.team'
    console.log('role.team created', rv.role.team.id)

    const newroleEditor = {
      pubId: rv.pub.id,
      name: 'Editor',
      isowner: false,
      canviewall: true,
      defaultrole: false,
      isreviewer: false,
      userRequested: false,
      userDeniedAccess: false
    }
    rv.role.editor = await models.pubroles.create(newroleEditor)
    if (!rv.role.editor) return 'Could not create role.editor'
    console.log('role.editor created', rv.role.editor.id)

    const newroleReviewer = {
      pubId: rv.pub.id,
      name: 'Reviewer',
      isowner: false,
      canviewall: false,
      defaultrole: false,
      isreviewer: true,
      userRequested: false,
      userDeniedAccess: false
    }
    rv.role.reviewer = await models.pubroles.create(newroleReviewer)
    if (!rv.role.reviewer) return 'Could not create role.reviewer'
    console.log('role.reviewer created', rv.role.reviewer.id)

    const newroleLead = {
      pubId: rv.pub.id,
      name: 'Lead',
      isowner: false,
      canviewall: false,
      defaultrole: false,
      isreviewer: true,
      userRequested: false,
      userDeniedAccess: false
    }
    rv.role.lead = await models.pubroles.create(newroleLead)
    if (!rv.role.lead) return 'Could not create role.lead'
    console.log('role.lead created', rv.role.lead.id)

    const newroleAccessRequested = {
      pubId: rv.pub.id,
      name: 'Access Requested',
      isowner: false,
      canviewall: false,
      defaultrole: false,
      isreviewer: false,
      userRequested: true,
      userDeniedAccess: false
    }

    rv.role.accessRequested = await models.pubroles.create(newroleAccessRequested)
    if (!rv.role.accessRequested) return 'Could not create role.accessRequested'
    console.log('role.accessRequested created', rv.role.accessRequested.id)

    const newroleAccessDenied = {
      pubId: rv.pub.id,
      name: 'Lead',
      isowner: false,
      canviewall: false,
      defaultrole: false,
      isreviewer: false,
      userRequested: false,
      userDeniedAccess: true
    }
    rv.role.accessDenied = await models.pubroles.create(newroleAccessDenied)
    if (!rv.role.accessDenied) return 'Could not create role.accessDenied'
    console.log('role.accessDenied created', rv.role.accessDenied.id)

    // Flow stages
    rv.stage = {}
    const newstageProposal = {
      flowId: rv.flow.id,
      weight: 10,
      name: 'Proposal',
      pubroleId: rv.role.author.id,
      rolecanadd: 0
    }
    rv.stage.proposal = await models.flowstages.create(newstageProposal)
    if (!rv.stage.proposal) return 'Could not create stage.proposal'
    console.log('stage.proposal created', rv.stage.proposal.id)

    const newstagePaper = {
      flowId: rv.flow.id,
      weight: 20,
      name: 'Paper',
      pubroleId: rv.role.author.id,
      rolecanadd: 0
    }
    rv.stage.paper = await models.flowstages.create(newstagePaper)
    if (!rv.stage.paper) return 'Could not create stage.paper'
    console.log('stage.paper created', rv.stage.paper.id)

    // Flow statuses
    rv.status = {}
    const newstatusProposalSubmitted = {
      flowId: rv.flow.id,
      weight: 10,
      status: 'Proposal submitted',
      visibletoauthor: true,
      ended: false,
      submittedflowstageId: rv.stage.proposal.id,
      cansubmitflowstageId: 0,
      owneradvice: 'Awaiting send to team'
    }
    rv.status.poposalSubmitted = await models.flowstatuses.create(newstatusProposalSubmitted)
    if (!rv.status.poposalSubmitted) return 'Could not create status.poposalSubmitted'
    console.log('status.poposalSubmitted created', rv.status.poposalSubmitted.id)

    const newstatusProposalWithTeam = {
      flowId: rv.flow.id,
      weight: 20,
      status: 'Proposal with team',
      visibletoauthor: false,
      ended: false,
      submittedflowstageId: null,
      cansubmitflowstageId: 0,
      owneradvice: ''
    }
    rv.status.proposalWithTeam = await models.flowstatuses.create(newstatusProposalWithTeam)
    if (!rv.status.proposalWithTeam) return 'Could not create status.proposalWithTeam'
    console.log('status.proposalWithTeamcreated', rv.status.proposalWithTeam.id)

    const newstatusProposalRejected = {
      flowId: rv.flow.id,
      weight: 30,
      status: 'Proposal rejected',
      visibletoauthor: true,
      ended: true,
      submittedflowstageId: null,
      cansubmitflowstageId: 0,
      owneradvice: ''
    }
    rv.status.proposalRejected = await models.flowstatuses.create(newstatusProposalRejected)
    if (!rv.status.proposalRejected) return 'Could not create status.proposalRejected'
    console.log('status.proposalRejected created', rv.status.proposalRejected.id)

    const newstatusProposalAccepted = {
      flowId: rv.flow.id,
      weight: 40,
      status: 'Proposal accepted',
      visibletoauthor: true,
      ended: false,
      submittedflowstageId: null,
      cansubmitflowstageId: rv.stage.paper.id,
      owneradvice: ''
    }
    rv.status.proposalAccepted = await models.flowstatuses.create(newstatusProposalAccepted)
    if (!rv.status.proposalAccepted) return 'Could not create status.proposalAccepted'
    console.log('status.proposalAccepted created', rv.status.proposalAccepted.id)

    const newstatusPaperSubmitted = {
      flowId: rv.flow.id,
      weight: 50,
      status: 'Paper submitted',
      visibletoauthor: true,
      ended: false,
      submittedflowstageId: rv.stage.paper.id,
      cansubmitflowstageId: null,
      owneradvice: 'Awaiting: send to reviewers'
    }
    rv.status.paperSubmitted = await models.flowstatuses.create(newstatusPaperSubmitted)
    if (!rv.status.paperSubmitted) return 'Could not create status.paperSubmitted'
    console.log('status.paperSubmitted created', rv.status.paperSubmitted.id)

    const newstatusPaperWithReviewers = {
      flowId: rv.flow.id,
      weight: 60,
      status: 'Paper with reviewers',
      visibletoauthor: false,
      ended: false,
      submittedflowstageId: null,
      cansubmitflowstageId: null,
      owneradvice: ''
    }
    rv.status.paperWithReviewers = await models.flowstatuses.create(newstatusPaperWithReviewers)
    if (!rv.status.paperWithReviewers) return 'Could not create status.paperWithReviewers'
    console.log('status.paperWithReviewers created', rv.status.paperWithReviewers.id)

    const newstatusPaperRejected = {
      flowId: rv.flow.id,
      weight: 70,
      status: 'Paper rejected',
      visibletoauthor: true,
      ended: true,
      submittedflowstageId: null,
      cansubmitflowstageId: null,
      owneradvice: ''
    }
    rv.status.paperRejected = await models.flowstatuses.create(newstatusPaperRejected)
    if (!rv.status.paperRejected) return 'Could not create status.paperRejected'
    console.log('status.paperRejected created', rv.status.paperRejected.id)

    const newstatusPaperAccepted = {
      flowId: rv.flow.id,
      weight: 80,
      status: 'Paper accepted',
      visibletoauthor: true,
      ended: true,
      submittedflowstageId: null,
      cansubmitflowstageId: null,
      owneradvice: ''
    }
    rv.status.paperAccepted = await models.flowstatuses.create(newstatusPaperAccepted)
    if (!rv.status.paperAccepted) return 'Could not create status.paperAccepted'
    console.log('status.paperAccepted created', rv.status.paperAccepted.id)

    // Flow grades and flow grade scores
    rv.flowgrade = {}
    const newflowgradeProposal = {
      flowId: rv.flow.id,
      name: 'Proposal score',
      flowstatusId: rv.status.proposalWithTeam.id,
      displayflowstageId: rv.stage.proposal.id,
      visibletorole: rv.role.team.id,
      visibletoreviewers: false,
      cancomment: true,
      canopttoreview: true,
      authorcanseeatthesestatuses: null,
      helptext: '',
      helplinktext: '',
      helplink: ''
    }
    rv.flowgrade.proposal = await models.flowgrades.create(newflowgradeProposal)
    if (!rv.flowgrade.proposal) return 'Could not create flowgrade.proposal'
    console.log('flowgrade.proposal created', rv.flowgrade.proposal.id)

    rv.flowgrade.score = {}
    const newflowgradeProposalAccept = {
      flowgradeId: rv.flowgrade.proposal.id,
      weight: 10,
      name: 'Accept'
    }
    rv.flowgrade.score.proposalAccept = await models.flowgradescores.create(newflowgradeProposalAccept)
    if (!rv.flowgrade.score.proposalAccept) return 'Could not create flowgrade.score.proposalAccept'
    console.log('flowgrade.score.proposalAccept created', rv.flowgrade.score.proposalAccept.id)

    const newflowgradeProposalReject = {
      flowgradeId: rv.flowgrade.proposal.id,
      weight: 20,
      name: 'Reject'
    }
    rv.flowgrade.score.proposalReject = await models.flowgradescores.create(newflowgradeProposalReject)
    if (!rv.flowgrade.score.proposalReject) return 'Could not create flowgrade.score.proposalReject'
    console.log('flowgrade.score.proposalReject created', rv.flowgrade.score.proposalReject.id)

    const newflowgradeProposalConflict = {
      flowgradeId: rv.flowgrade.proposal.id,
      weight: 30,
      name: 'Conflict of Interest'
    }
    rv.flowgrade.score.proposalConflict = await models.flowgradescores.create(newflowgradeProposalConflict)
    if (!rv.flowgrade.score.proposalConflict) return 'Could not create flowgrade.score.proposalConflict'
    console.log('flowgrade.score.proposalConflict created', rv.flowgrade.score.proposalConflict.id)

    const stati = [rv.status.paperAccepted, rv.status.paperRejected]
    const newflowgradePaper = {
      flowId: rv.flow.id,
      name: 'Paper review',
      flowstatusId: rv.status.paperWithReviewers.id,
      displayflowstageId: rv.stage.paper.id,
      visibletorole: 0,
      visibletoreviewers: true,
      cancomment: true,
      canopttoreview: false,
      authorcanseeatthesestatuses: stati.join(),
      helptext: 'Grade this paper',
      helplinktext: 'Need help?',
      helplink: 'https://example.org/'
    }
    rv.flowgrade.paper = await models.flowgrades.create(newflowgradePaper)
    if (!rv.flowgrade.paper) return 'Could not create flowgrade.paper'
    console.log('flowgrade.paper created', rv.flowgrade.paper.id)

    const newflowgradePaperAccept = {
      flowgradeId: rv.flowgrade.paper.id,
      weight: 10,
      name: 'Accept'
    }
    rv.flowgrade.score.paperAccept = await models.flowgradescores.create(newflowgradePaperAccept)
    if (!rv.flowgrade.score.paperAccept) return 'Could not create flowgrade.score.paperAccept'
    console.log('flowgrade.score.paperAccept created', rv.flowgrade.score.paperAccept.id)

    const newflowgradePaperReject = {
      flowgradeId: rv.flowgrade.paper.id,
      weight: 20,
      name: 'Reject'
    }
    rv.flowgrade.score.paperReject = await models.flowgradescores.create(newflowgradePaperReject)
    if (!rv.flowgrade.score.paperReject) return 'Could not create flowgrade.score.paperReject'
    console.log('flowgrade.score.paperReject created', rv.flowgrade.score.paperReject.id)

    // Publication lookups
    rv.publookup = {}
    const newpublookupTopics = {
      pubId: rv.pub.id,
      name: 'Topics'
    }
    rv.publookup.topics = await models.publookups.create(newpublookupTopics)
    if (!rv.publookup.topics) return 'Could not create publookup.topics'
    console.log('publookup.topics created', rv.publookup.topics.id)

    rv.publookup.value = {}
    const newpublookupTopicClimate = {
      publookupId: rv.publookup.topics.id,
      weight: 10,
      text: 'Climate Change'
    }
    rv.publookup.value.climate = await models.publookupvalues.create(newpublookupTopicClimate)
    if (!rv.publookup.value.climate) return 'Could not create publookup.value.climate'
    console.log('publookup.value.climate created', rv.publookup.value.climate.id)

    const newpublookupTopicBiodiversity = {
      publookupId: rv.publookup.topics.id,
      weight: 20,
      text: 'Biodiversity'
    }
    rv.publookup.value.biodiversity = await models.publookupvalues.create(newpublookupTopicBiodiversity)
    if (!rv.publookup.value.biodiversity) return 'Could not create publookup.value.biodiversity'
    console.log('publookup.value.biodiversity created', rv.publookup.value.biodiversity.id)

    // Form fields
    rv.formfield = {}
    const newformfieldName = {
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
    console.log('formfield.name created', rv.formfield.name.id)

    return false
  } catch (e) {
    return e.message
  }
}

module.exports = {
  name,
  runscript
}
