const bcrypt = require('bcrypt')
const saltRounds = 10

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

  const users = await models.users.findAll()
  if (users.length === 0) {
    const params = {
      name: 'Jo',
      username: 'jo',
      email: 'jo@example.com',
      password: await bcrypt.hash('asecret', saltRounds),
      super: true
    }
    const dbuser = await models.users.create(params)
    if (!dbuser) return
    console.log('User created', params.name)
  }
}

module.exports = testsetup
