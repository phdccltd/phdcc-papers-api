// CALLED ONLY ONCE BEFORE ALL TESTS

// https://docs.travis-ci.com/user/database-setup/#sqlite3

function setupOnce() {
  console.log('JEST ONCE')
  process.env = {}

  process.env.JWT_SECRET = 'Testing-seret'
  process.env.TESTING = true
}

module.exports = setupOnce
