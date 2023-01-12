// Always set 'ret', 0 if OK

const { Router } = require('express')
// const path = require('path')

const utils = require('../utils')

const auth = require('./auth')
const acceptingsRouter = require('./acceptings')
const downloadsRouter = require('./downloads')
const gradingsRouter = require('./gradings')
const mailRouter = require('./mail')
const pubsRouter = require('./pubs')
const reviewersRouter = require('./reviewers')
const sitepagesRouter = require('./sitepages')
const sitepagessuperRouter = require('./sitepagessuper')
const submitsRouter = require('./submits')
const users = require('./users')

const router = Router()

/// ///////////////////
// Initialize Passport and restore authentication state, if any, from the auth.
router.use(auth.passport.initialize())

/// ///////////////////
/* ALL: */
router.use(function (req, res, next) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', 0)

  // NO: requests come through as non-xhr
  // If production, then don't allow vanilla web requests
  // if (req.app.get('env')=='production') {
  //  if (!req.xhr) return utils.giveup(req, res, 'Non-XHR requests not permitted')
  // }

  // req.baseUrl is eg /user/login for call at /api/user/login
  if (process.env.TESTING === 'forclient') {
    if (req.url.indexOf('/api') === 0) {
      req.url = req.url.substr(4)
    }
  }
  req.fullurl = req.baseUrl + req.url // eg /user
  // console.log("req.url", req.url)

  // Load site (from list cached at startup)
  const host = req.get('host')
  const sites = req.app.get('sites')
  if (process.env.TESTING) {
    req.site = sites[0]
  } else {
    req.site = sites.find(site => site.url === host)
    if (!req.site) {
      return utils.giveup(req, res, 'Not running on valid site')
    }
  }

  next()
})

/* ALL: just give up if path ends in slash */
router.use(function (req, res, next) {
  if (req.path.substr(-1) === '/' && req.path.length > 1) {
    return utils.giveup(req, res, 'Invalid path')
    /* const query = req.url.slice(req.path.length)
    const npath = path.normalize(req.path)
    if (npath.indexOf('..') !== -1) return utils.giveup(req, res, 'Invalid path')
    if (npath.substr(-1) !== '/') return utils.giveup(req, res, 'Invalid path')
    console.log("redirect from", process.env.BASEURL, req.baseUrl, npath)
    const goto = process.env.BASEURL + req.baseUrl + npath.slice(0, -1) + query
    // console.log("redirect to", goto)
    res.redirect(301, goto) */
  } else {
    next()
  }
})

if (process.env.TESTING) {
  router.delete('/resetdbfortest', async function (req, res, next) {
    console.log('====resetdbfortest')
    try {
      const app = require('../app')
      const maketestsite = require('../tests/maketestsite')
      const runscript = require('../tests/runscript')
      const models = require('../models')

      await models.deleteall()

      await app.checkDatabases(maketestsite)

      const config = {}
      let error = await runscript.run(app.models, 'addpubsimpleflow.json', config)
      if (error) throw new Error(error)

      error = await runscript.run(app.models, 'tests/addusers.json', config)
      if (error) throw new Error(error)
      return utils.returnOK(req, res, 'database reset OK')
    } catch (error) {
      console.log(error)
      return utils.exterminate(req, res, error)
    }
  })
}

/* GET: SITEPAGES */
router.use(sitepagesRouter)

/// ///////////////////
/* POST: HANDLE LOGIN ATTEMPT */
router.post('/user/login', auth.login)

/// ///////////////////
/* POST: HANDLE REGISTER ATTEMPT */
router.post('/user/register', auth.register)

/// ///////////////////
/* POST: HANDLE FORGOT PASSWORD */
router.post('/user/forgot', auth.forgotpwd)

/* ALL: CHECK LOGGED IN */
// Must be logged in from now on
router.use(auth.loaduser)

/* DELETE: LOGOUT */
router.delete('/user/logout', auth.logout)

/* GET: USER */
router.get('/user', auth.getuser)

/* POST+PATCH: USER */
router.post('/user', auth.saveuser)

/* POST: ADD PUB USER ROLE */
/* POST_DELETE: REMOVE PUB USER ROLE */
router.post('/users/pub/:pubid/:userid/:roleid', users.handleUserRole)

/* POST_DELETE: REMOVE PUB USER */
router.post('/users/pub/:pubid/:userid', users.removePubUser)

/* GET: GET PUB USERS */
router.get('/users/pub/:pubid', users.getPubUsers)

/* GET: MASQUERADE */
router.get('/users/masquerade/:userid', users.handleMasquerade)

/* GET: USERS */
router.get('/users', users.getAllUsers)

/// ///////////////////
// /sitepages super
router.use(sitepagessuperRouter)

/// ///////////////////
// /pubs/*
router.use(pubsRouter)

/// ///////////////////
// /mailtemplates/*
router.use(mailRouter)

/// ///////////////////
// /acceptings/*
router.use(acceptingsRouter)

/// ///////////////////
// /acceptings/*
router.use(reviewersRouter)

/// ///////////////////
// /downloads/*
router.use(downloadsRouter)

/// ///////////////////
// /gradings/*
router.use(gradingsRouter)

/// ///////////////////
// /submits/*
router.use(submitsRouter)

/// ///////////////////
module.exports = {
  router
}
