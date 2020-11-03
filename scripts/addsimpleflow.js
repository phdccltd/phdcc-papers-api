const name = 'Add simple flow'

async function runscript(models) {
  console.log('ADD SIMPLE FLOW')

  try {

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
    const dbpub = await models.pubs.create(newpub)
    if (!dbpub) return 'Could not create pub'
    console.log('dbpub created', dbpub.id)

    const newflow = {
      pubId: dbpub.id,
      name: 'Paper',
      description: 'Proposal followed by Paper'
    }
    const dbflow = await models.flows.create(newflow)
    if (!dbflow) return 'Could not create flow'
    console.log('dbflow created', dbflow.id)

    const newroleOwner = {
      pubId: dbpub.id,
      name: 'Owner',
      isowner: true,
      canviewall: false,
      defaultrole: false,
      isreviewer: false,
      userRequested: false,
      userDeniedAccess: false,
    }
    const dbroleOwner = await models.pubroles.create(newroleOwner)
    if (!dbroleOwner) return 'Could not create roleOwner'
    console.log('dbroleOwner created', dbroleOwner.id)

    const newroleAuthor = {
      pubId: dbpub.id,
      name: 'Author',
      isowner: false,
      canviewall: false,
      defaultrole: true,
      isreviewer: false,
      userRequested: false,
      userDeniedAccess: false,
    }
    const dbroleAuthor = await models.pubroles.create(newroleAuthor)
    if (!dbroleAuthor) return 'Could not create roleAuthor'
    console.log('dbroleAuthor created', dbroleAuthor.id)

    const newroleTeam = {
      pubId: dbpub.id,
      name: 'Team',
      isowner: false,
      canviewall: true,
      defaultrole: false,
      isreviewer: false,
      userRequested: false,
      userDeniedAccess: false,
    }
    const dbroleTeam = await models.pubroles.create(newroleTeam)
    if (!dbroleTeam) return 'Could not create roleTeam'
    console.log('dbroleTeam created', dbroleTeam.id)

    const newroleReviewer = {
      pubId: dbpub.id,
      name: 'Reviewer',
      isowner: false,
      canviewall: false,
      defaultrole: false,
      isreviewer: true,
      userRequested: false,
      userDeniedAccess: false,
    }
    const dbroleReviewer = await models.pubroles.create(newroleReviewer)
    if (!dbroleReviewer) return 'Could not create roleReviewer'
    console.log('dbroleReviewer created', dbroleReviewer.id)

    const newroleLead = {
      pubId: dbpub.id,
      name: 'Lead',
      isowner: false,
      canviewall: false,
      defaultrole: false,
      isreviewer: true,
      userRequested: false,
      userDeniedAccess: false,
    }
    const dbroleLead = await models.pubroles.create(newroleLead)
    if (!dbroleLead) return 'Could not create roleLead'
    console.log('dbroleLead created', dbroleLead.id)

    const newroleAccessRequested = {
      pubId: dbpub.id,
      name: 'Access Requested',
      isowner: false,
      canviewall: false,
      defaultrole: false,
      isreviewer: false,
      userRequested: true,
      userDeniedAccess: false,
    }

    const dbroleAccessRequested = await models.pubroles.create(newroleAccessRequested)
    if (!dbroleAccessRequested) return 'Could not create roleAccessRequested'
    console.log('dbroleAccessRequested created', dbroleAccessRequested.id)

    const newroleAccessDenied = {
      pubId: dbpub.id,
      name: 'Lead',
      isowner: false,
      canviewall: false,
      defaultrole: false,
      isreviewer: false,
      userRequested: false,
      userDeniedAccess: true,
    }
    const dbroleAccessDenied = await models.pubroles.create(newroleAccessDenied)
    if (!dbroleAccessDenied) return 'Could not create roleAccessDenied'
    console.log('dbroleAccessDenied created', dbroleAccessDenied.id)

    const newstageProposal = {
      flowId: dbflow.id,
      weight: 10,
      name: 'Proposal',
      pubroleId: dbroleAuthor.id,
      rolecanadd: 0
    }
    const dbstageProposal = await models.flowstages.create(newstageProposal)
    if (!dbstageProposal) return 'Could not create stageProposal'
    console.log('dbstageProposal created', dbstageProposal.id)

    const newstagePaper = {
      flowId: dbflow.id,
      weight: 20,
      name: 'Paper',
      pubroleId: dbroleAuthor.id,
      rolecanadd: 0
    }
    const dbstagePaper = await models.flowstages.create(newstagePaper)
    if (!dbstagePaper) return 'Could not create stagePaper'
    console.log('dbstagePaper created', dbstagePaper.id)

    return false
  } catch (e) {
    return e.message
  }
}

module.exports = {
  name,
  runscript
}
