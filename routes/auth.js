// `user` is real, `ppuser' is the JWT user in token

const { Router } = require('express')

const _ = require('lodash/core')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const saltRounds = 10
const needle = require('needle')

const JWTstrategy = require('passport-jwt').Strategy;
const ExtractJWT = require('passport-jwt').ExtractJwt;
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
      return done(error);
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
      //console.log("JWTstrategy", decoded_token) // { ppuser: { id: 1, name: 'Chris', username: 'chris, super: true }, iat: 1593427250 }
      //Pass the user details to the next middleware
      return done(null, decoded_token.ppuser);
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

  function authenticate() {
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

          req.logIn(user, { session: false }, async (err) => {
            if (err) {
              console.log("req.logIn err", err)
              return utils.giveup(req, res, err.message)
            }
            logger.log("LOGGED IN", user.username, user.id)
            const ppuser = { id: user.id, name: user.name, username: user.username, super: user.super }
            const token = jwt.sign({ ppuser }, process.env.JWT_SECRET)
            return res.json({ ret: 0, token })
          })
        } catch (error) {
          console.log("login exception", error)
          utils.exterminate(req, res, error)
        }
      }
    )(req, res, next)
  }

  const recaptchaResponseToken = req.body['g-recaptcha-response']
  if (recaptchaResponseToken === process.env.RECAPTCHA_BYPASS) {
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
/* POST: HANDLE REGISTER ATTEMPT, using given passport */
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
  //if (!('g-recaptcha-response' in req.body) || (req.body['g-recaptcha-response'].trim().length === 0)) return utils.giveup(req, res, 'recaptcha not given')

  console.log('register', name)

  const params = {
    name: name,
    username: username,
    password: await bcrypt.hash(req.body.password.trim(), saltRounds),
    email: req.body.email.trim(),
  }
  const user = await models.users.create(params);
  if (!user) return utils.giveup(req, res, 'user not created')

  return utils.giveup(req, res, 'user created')

  /*function authenticate() {
    //console.log("post authenticate", req.body['username'])
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

          req.logIn(user, { session: false }, async (err) => {
            if (err) {
              console.log("req.logIn err", err)
              return utils.giveup(req, res, err.message)
            }
            logger.log("LOGGED IN", user.username, user.id)
            const ppuser = { id: user.id, name: user.name, username: user.username, super: user.super }
            const token = jwt.sign({ ppuser }, process.env.JWT_SECRET)
            return res.json({ ret: 0, token })
          })
        } catch (error) {
          console.log("login exception", error)
          utils.exterminate(req, res, error)
        }
      }
    )(req, res, next)
  }

  authenticate()*/

  /*const recaptchaResponseToken = req.body['g-recaptcha-response']
  if (recaptchaResponseToken === undefined || recaptchaResponseToken === '' || recaptchaResponseToken === null) {
    return utils.giveup(req, res, 'Please select captcha first')
  }

  if (recaptchaResponseToken === process.env.RECAPTCHA_BYPASS) {
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

  })*/
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
        const newppuser = { id: user.id, name: user.name, username: user.username, super: user.super }
        if (!_.isEqual(newppuser, ppuser)) {
          console.log('AUTH LOADUSER ppuser refreshed', newppuser, ppuser)
        }
        req.ppuser = newppuser
        logger.log('User is', req.ppuser.id, req.ppuser.username)
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
  logger.log("Logging out " + req.ppuser.username)
  req.logout()
  res.status(200).json({ ret: 0, status: 'Logged out' })
}

/* GET: GETUSER */
function getuser(req, res) {
  logger.log("getuser")
  if (!req.ppuser) return utils.giveup(req, res, 'Not logged in unexpectedly')
  res.status(200).json({ ret: 0, user: req.ppuser })
}

module.exports = {
  passport: passport,
  login: login,
  register: register,
  logout: logout,
  getuser: getuser,
  loaduser: loaduser
}

