// `user` is real, `ppuser' is the JWT user in token only with 'id'

const { Router } = require('express')

const _ = require('lodash/core')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const saltRounds = 10
const needle = require('needle')

const JWTstrategy = require('passport-jwt').Strategy
const ExtractJWT = require('passport-jwt').ExtractJwt
const jwt = require('jsonwebtoken')

const models = require('../models')
const logger = require('../logger')
const utils = require('../utils')

//////////////////////
// LOGIN devolved checker
passport.use('login', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
  },
  async (username, password, done) => {
    try {
      //console.log('verify', username)
      const user = await models.users.findOne({ where: { username: username } })
      if (!user) throw new Error('Incorrect username')
      const match = await bcrypt.compare(password, user.password)
      if (!match) throw new Error('Incorrect password')
      user.lastlogin = new Date()
      await user.save()
      done(null, user, { message: 'Logged in Successfully' })
    } catch (error) {
      return done(error)
    }
  }
))

//////////////////////
// TOKEN devolved checker - checked for every post - verifies that the sent token is valid
passport.use(new JWTstrategy({
  secretOrKey: process.env.JWT_SECRET,
  jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken() // get from header authorization: 'bearer ...'
  /*function(req) { // Could use in testing
      console.log("jwtFromRequest")
        const token = ExtractJWT.fromAuthHeaderAsBearerToken()(req)
        console.log("token", token)
        return token+'x'
      }*/
}, async (decoded_token, done) => { // Only called if JWT verifies
  try {
    //console.log("JWTstrategy", decoded_token) // { ppuser: { id: 1 }, iat: 1593427250 }
    //Pass the user details to the next middleware
    return done(null, decoded_token.ppuser)
  } catch (error) {
    done(error)
  }
}))

//////////////////////
/* POST: HANDLE LOGIN ATTEMPT, using given passport */
function login(req, res, next) {

  if (!('username' in req.body) || (req.body.username.trim().length === 0)) return utils.giveup(req, res, 'username not given')
  if (!('password' in req.body) || (req.body.password.trim().length === 0)) return utils.giveup(req, res, 'password not given')
  if (!('g-recaptcha-response' in req.body) || (req.body['g-recaptcha-response'].trim().length === 0)) return utils.giveup(req, res, 'recaptcha not given')

  function authenticate(postRegisterId) {
    //console.log("post login", req.body['username'])
    passport.authenticate('login',  // Calls login function above which fills in user (or err)
      async (err, user, info) => {
        try {
          //console.log("authenticate OVER:", err, info)
          if (info) {
            //logger.log("login authenticate info", user, info.message)
            logger.log("login authenticate info", info.message)
          } else info = ''

          if (err || !user) {
            if (!err) err = new Error('Login Error')
            return utils.giveup(req, res, err.message)
          }
          if (postRegisterId && (postRegisterId !== user.id)) {
            return utils.giveup(req, res, 'postRegisterId mismatch')
          }

          req.logIn(user, { session: false }, async (err) => {
            if (err) {
              console.log("req.logIn err", err)
              return utils.giveup(req, res, err.message)
            }
            logger.log("LOGGED IN", user.username, user.id)
            const ppuser = { id: user.id }
            const token = jwt.sign({ ppuser }, process.env.JWT_SECRET)
            utils.returnOK(req, res, token, 'token')
          })
        } catch (error) {
          console.log("login exception", error)
          utils.exterminate(req, res, error)
        }
      }
    )(req, res, next)
  }

  // If just registered, then don't validate recaptcha again
  let postRegisterId = false
  if ('token' in req.body) {
    try {
      const tuser = jwt.verify(req.body.token, process.env.JWT_SECRET)
      console.log('TUSER', tuser)
      postRegisterId = tuser.id
      if (!postRegisterId) return utils.giveup(req, res, 'Post-registration token no id')
    } catch (e) {
      return utils.giveup(req, res, 'Failed post-registration token validation')
    }
  }

  const recaptchaResponseToken = req.body['g-recaptcha-response']
  if (postRegisterId || (recaptchaResponseToken === process.env.RECAPTCHA_BYPASS)) {
    authenticate()
    return
  }

  const verificationURL = "https://www.google.com/recaptcha/api/siteverify?secret=" + process.env.RECAPTCHA_SECRET_KEY + "&response=" + recaptchaResponseToken + "&remoteip=" + req.userip

  needle.get(verificationURL, function (error, response, body) {
    console.log("recaptchad", body)

    if (body.success !== undefined && !body.success) {
      return utils.giveup(req, res, 'Failed captcha verification')
    }

    authenticate()

  })
}

//////////////////////
/* POST: HANDLE REGISTER ATTEMPT, using given passport
   Simply creates user: if successful, caller must then do login
*/
async function register(req, res, next) {

  console.log('register')
  if (!('username' in req.body) || (req.body.username.trim().length === 0)) return utils.giveup(req, res, 'username not given')
  const username = req.body.username.trim()
  let name = username
  if (('name' in req.body) && (req.body.name.trim().length > 0)) {
    name = req.body.name.trim()
  }
  if (!('password' in req.body) || (req.body.password.trim().length === 0)) return utils.giveup(req, res, 'password not given')
  if (!('email' in req.body) || (req.body.email.trim().length === 0)) return utils.giveup(req, res, 'email not given')
  if (!('g-recaptcha-response' in req.body) || (req.body['g-recaptcha-response'].trim().length === 0)) return utils.giveup(req, res, 'recaptcha not given')

  console.log('register', name)

  async function createuser() {
    const params = {
      name: name,
      username: username,
      password: await bcrypt.hash(req.body.password.trim(), saltRounds),
      email: req.body.email.trim(),
    }
    try {
      // Although username must be unique, explicitly check first
      const existing = await models.users.findOne({ where: { username: username } })
      if (existing) {
        return utils.giveup(req, res, 'username already in use')
      }

      // Create user now
      const user = await models.users.create(params)
      if (!user) return utils.giveup(req, res, 'user not created')

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET)

      utils.async_mail(false, req.site.name + ". API User registered: " + username, 'Name: ' + params.name+'\r\nEmail: ' + params.email)
      utils.returnOK(req, res, { token }, 'user')
    } catch (e) {
      logger.log(e.message)
      utils.giveup(req, res, 'Could not create user')
    }
  }

  const recaptchaResponseToken = req.body['g-recaptcha-response']
  if (recaptchaResponseToken === undefined || recaptchaResponseToken === '' || recaptchaResponseToken === null) {
    return utils.giveup(req, res, 'Please select captcha first')
  }

  if (recaptchaResponseToken === process.env.RECAPTCHA_BYPASS) {
    createuser()
    return
  }

  const verificationURL = "https://www.google.com/recaptcha/api/siteverify?secret=" + process.env.RECAPTCHA_SECRET_KEY + "&response=" + recaptchaResponseToken + "&remoteip=" + req.userip

  needle.get(verificationURL, function (error, response, body) {
    console.log("recaptchad", body)

    if (body.success !== undefined && !body.success) {
      return utils.giveup(req, res, 'Failed captcha verification')
    }

    createuser()

  })


}

//////////////////////
/* ALL: CHECK LOGGED IN */
// Must be logged in from now on
// req.ppuser is passport user
function loaduser(req, res, next) {
  //console.log('CHECK LOGGED IN')
  passport.authenticate('jwt', { session: false },
    async (err, ppuser, info) => {
      if (ppuser) {
        // DOUBLE-CHECK THAT USER OK?
        const user = await models.users.findByPk(ppuser.id)
        if (!user) {
          logger.log('Stale login', ppuser.id)
          return utils.giveup(req, res, 'Stale login')
        }
        req.user = user
        const newppuser = { id: user.id }
        if (!_.isEqual(newppuser, ppuser)) {
          console.log('AUTH LOADUSER ppuser refreshed', newppuser, ppuser)
        }
        req.ppuser = newppuser
        logger.log('User is', req.ppuser.id, req.user.username, req.user.name)
        next()
        return
      }
      logger.log('LOGIN TOKEN FAIL', err, info)
      return utils.giveup(req, res, 'Not logged in')
    }
  )(req, res, next)
}

/* DELETE: LOGOUT */
function logout(req, res) {
  logger.log("Logging out ", req.ppuser.id, req.user.username)
  req.logout()
  utils.returnOK(req, res, 'Logged out')
}

/* GET: GETUSER */
function getuser(req, res) {
  logger.log("getuser")
  if (!req.ppuser) return utils.giveup(req, res, 'Not logged in unexpectedly')
  console.log(req.ppuser)
  const rvuser = {
    id: req.user.id,
    username: req.user.username,
    name: req.user.name,
    super: req.user.super,
  }
  utils.returnOK(req, res, rvuser, 'user')
}

/* POST+PATCH: SAVEUSER */
async function saveuser(req, res, next) {
  if (req.headers['x-http-method-override'] !== 'PATCH') {
    console.log("NOT saveuser")
    next()
    return
  }
  console.log("saveuser")

  try {
    if (!req.ppuser) return utils.giveup(req, res, 'Not logged in unexpectedly')

    let name = false
    if (('name' in req.body) && (req.body.name.trim().length > 0)) name = req.body.name.trim()
    let password = false
    if (('password' in req.body) && (req.body.password.trim().length > 0)) password = req.body.password.trim()
    if (password) {
      password = await bcrypt.hash(password, saltRounds)
    }

    if (!name && !password) return utils.giveup(req, res, 'No changed user params')
    if (name) req.user.name = name
    if (password) req.user.password = password
    await req.user.save()
    utils.returnOK(req, res, 'User updated')
    console.log("saveuser DONE OK")
  } catch (error) {
    console.log(error)
    return utils.exterminate(req, res, error)
  }
}

module.exports = {
  passport: passport,
  login: login,
  register: register,
  logout: logout,
  getuser: getuser,
  saveuser: saveuser,
  loaduser: loaduser
}

