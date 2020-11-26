const utils = require('../utils')

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

    // Fake a mail transport
    const transport = {
      sendMail: function (params, callbacks) {
        callbacks(false, 'MOCK sendMail to ' + params.to)
      }
    }
    utils.setMailTransport(transport, 'from@example.org', 'admin@example.org', 'TESTS')
    utils.getSiteName()
    console.log('mock site created')
  }
}

module.exports = testsetup
