async function testsetup (models) {
  console.log('TESTSETUP')

  const sites = await models.sites.findAll()
  console.log('sites', sites.length)
  if (sites.length === 0) {
    const params = {
      url: '',
      name: 'Test site',
      privatesettings: JSON.stringify({}),
      publicsettings: JSON.stringify({})
    }
    await models.sites.create(params)
    console.log('mock site created')
  }
}

module.exports = testsetup
