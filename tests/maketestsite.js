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
      sendMail: function (_params, callbacks) {
        if (_params.subject.indexOf('Proposal') !== -1) {
          callbacks('Pretend fail', false)
        } else {
          callbacks(false, 'MOCK sendMail to ' + _params.to)
        }
      }
    }
    utils.setMailTransport(transport, 'from@example.org', 'admin@example.org', 'TESTS')
    utils.getSiteName()

    // Coverage
    await utils.asyncSleep(10)

    console.log('mock site created')
  }
}

module.exports = testsetup
