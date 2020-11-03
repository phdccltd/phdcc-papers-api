// CALLED ONLY ONCE BEFORE ALL TESTS

function setupOnce () {
  console.log('JEST ONCE')
  process.env = {}

  process.env.JWT_SECRET = 'Testing-seret'
  process.env.TESTING = true
}

module.exports = setupOnce
