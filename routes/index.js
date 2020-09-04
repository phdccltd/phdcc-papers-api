// Always set 'ret', 0 if OK

const { Router } = require('express')

const models = require('../models');
const logger = require('../logger')
const utils = require('../utils')

const auth = require('./auth')
const users = require('./users')
const pubsRouter = require('./pubs')
const submitsRouter = require('./submits')
const sitepagesRouter = require('./sitepages')

const router = Router()

//////////////////////
// Initialize Passport and restore authentication state, if any, from the auth.
router.use(auth.passport.initialize());
//router.use(auth.passport.session());

//////////////////////
/* ALL: */
router.use(function (req, res, next) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", 0);

  // If production, then don't allow vanilla web requests
  if (req.app.get('env')=='production') {
    //if (!req.xhr) return utils.giveup(req, res, 'Non-XHR requests not permitted')
  }

  // req.baseUrl is eg /user/login for call at /api/user/login
  req.fullurl = req.baseUrl + req.url // eg /user

  // Load site (from list cached at startup)
  const host = req.get('host')
  const sites = req.app.get('sites')
  if (process.env.TESTING) {
    req.site = sites[0]
  } else {
    req.site = sites.find(site => site.url == host)
    if (!req.site) {
      return utils.giveup(req, res, 'Not running on valid site')
    }
  }

  next()
})

/* ALL: redirect from xxx/ to xxx */
router.use(function (req, res, next) {
  if (req.path.substr(-1) === '/' && req.path.length > 1) {
    var query = req.url.slice(req.path.length)
    //console.log("redirect from", req.path)
    const goto = process.env.BASEURL + req.baseUrl + req.path.slice(0, -1) + query
    //console.log("redirect to", goto)
    res.redirect(301, goto)
  } else {
    next()
  }
});

/* GET: SITEPAGES */
router.use(sitepagesRouter)

//////////////////////
/* POST: HANDLE LOGIN ATTEMPT */
router.post('/user/login', auth.login)

//////////////////////
/* POST: HANDLE REGISTER ATTEMPT */
router.post('/user/register', auth.register)

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

//////////////////////
// /pubs/*
router.use(pubsRouter)

//////////////////////
// /submits/*
router.use(submitsRouter)

//////////////////////
module.exports = {
  router
}
