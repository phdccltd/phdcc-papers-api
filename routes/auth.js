// `user` is real, `ppuser' is the JWT user in token only with 'id'

// TODO: Work out how to log out all instances

const _lang = require('lodash/lang')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const saltRounds = 10
const needle = require('needle')
const crypto = require('crypto')
const { isEmail } = require('validator')

const JWTstrategy = require('passport-jwt').Strategy
const ExtractJWT = require('passport-jwt').ExtractJwt
const jwt = require('jsonwebtoken')

const models = require('../models')
const logger = require('../logger')
const utils = require('../utils')
const mailutils = require('./mailutils')

/// ///////////////////
// LOGIN devolved checker
passport.use('login', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password'
},
async (username, password, done) => {
  try {
    // console.log('verify', username)
    const user = await models.users.findOne({ where: { username } })
    if (!user) throw new Error('Incorrect username')
    const match = await bcrypt.compare(password, user.password)
    if (!match) throw new Error('Incorrect password')
    user.lastlogin = new Date()
    await user.save() // Transaction ??
    done(null, user, { message: 'Logged in Successfully' })
  } catch (error) {
    return done(error)
  }
}
))

/// ///////////////////
// TOKEN devolved checker - checked for every post - verifies that the sent token is valid
passport.use(new JWTstrategy({
  secretOrKey: process.env.JWT_SECRET,
  jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken() // get from header authorization: 'bearer ...'
  /* function(req) { // Could use in testing
      console.log('jwtFromRequest')
        const token = ExtractJWT.fromAuthHeaderAsBearerToken()(req)
        console.log('token', token)
        return token+'x'
      } */
}, async (decodedToken, done) => { // Only called if JWT verifies
  try {
    // console.log('JWTstrategy', decodedToken) // { ppuser: { id: 1 }, iat: 1593427250 }
    // Pass the user details to the next middleware
    return done(null, decodedToken.ppuser)
  } catch (error) {
    done(error)
  }
}))

/// ///////////////////

function getRecaptchaResponse (req) {
  console.log('g-recaptcha-response', req.body['g-recaptcha-response'])
  console.log('grecaptcharesponse', req.body.grecaptcharesponse)
  const gotgrr1 = ('g-recaptcha-response' in req.body) && (req.body['g-recaptcha-response'].trim().length > 0)
  const gotgrr2 = ('grecaptcharesponse' in req.body) && (req.body.grecaptcharesponse.trim().length > 0)
  if (!gotgrr1 && !gotgrr2) return false
  return gotgrr1 ? req.body['g-recaptcha-response'].trim() : req.body.grecaptcharesponse.trim()
}

/// ///////////////////
async function doResetLogin (req, res, next) {
  const resettoken = req.body.reset.trim()
  if (resettoken.length === 0) return utils.giveup(req, res, 'No reset')

  async function resetlogin () {
    console.log('resettoken', resettoken)

    const dbusers = await models.users.findAll({
      where: {
        resettoken
      }
    })
    console.log('dbusers.length', dbusers.length)
    if (dbusers.length !== 1) return utils.giveup(req, res, 'Invalid password reset. The link may have been used already. Please restart the password reset process.')
    const dbuser = dbusers[0]
    logger.log4req(req, 'login reset for', dbuser.id)

    if (Date.now() > dbuser.resetexpires.getTime()) return utils.giveup(req, res, 'Password reset link expired')

    req.login(dbuser, { session: false }, async (err) => {
      if (err) {
        console.log('req.login err', err)
        return utils.giveup(req, res, err.message)
      }
      dbuser.resettoken = null
      dbuser.resetexpires = null
      await dbuser.save() // Transaction ??

      logger.log4req(req, 'TOKEN LOGGED IN', dbuser.username, dbuser.id)
      const ppuser = { id: dbuser.id }
      const token = jwt.sign({ ppuser }, process.env.JWT_SECRET)
      utils.returnOK(req, res, token, 'token')
    })
  }

  const recaptchaResponseToken = getRecaptchaResponse(req)
  if (recaptchaResponseToken === process.env.RECAPTCHA_BYPASS) {
    resetlogin()
    return
  }

  const verificationURL = 'https://www.google.com/recaptcha/api/siteverify?secret=' + process.env.RECAPTCHA_SECRET_KEY + '&response=' + recaptchaResponseToken + '&remoteip=' + req.userip

  needle.get(verificationURL, function (er, response, body) {
    logger.log4req(req, 'recaptchad', body)

    if (body.success !== undefined && !body.success) {
      return utils.giveup(req, res, 'Failed captcha verification')
    }

    resetlogin()
  })
}

/// ///////////////////
/* POST: HANDLE LOGIN ATTEMPT, using given passport */
async function login (req, res, next) {
  const recaptchaResponseToken = getRecaptchaResponse(req)
  if (!recaptchaResponseToken) return utils.giveup(req, res, 'recaptcha not given')

  if ('reset' in req.body) return await doResetLogin(req, res, next)

  if (!('username' in req.body) || (req.body.username.trim().length === 0)) return utils.giveup(req, res, 'username not given')
  if (!('password' in req.body) || (req.body.password.trim().length === 0)) return utils.giveup(req, res, 'password not given')

  function authenticate (_postRegisterId) {
    // console.log('post login', req.body['username'])
    passport.authenticate('login', // Calls login function above which fills in user (or err)
      async (err, user, info) => {
        try {
          // console.log('authenticate OVER:', err, info)
          if (info) {
            logger.log4req(req, 'login authenticate info', info.message)
          }

          if (err || !user) {
            if (!err) err = new Error('Login Error')
            return utils.giveup(req, res, err.message)
          }

          if (_postRegisterId && (_postRegisterId !== user.id)) {
            return utils.giveup(req, res, 'postRegisterId mismatch')
          }

          req.login(user, { session: false }, async (err2) => {
            if (err2) {
              console.log('req.login err2', err2)
              return utils.giveup(req, res, err2.message)
            }
            logger.log4req(req, 'LOGGED IN', user.username, user.id)
            const ppuser = { id: user.id }
            const token = jwt.sign({ ppuser }, process.env.JWT_SECRET)
            utils.returnOK(req, res, token, 'token')
          })
        } catch (error) {
          console.log('login exception', error)
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
      // console.log('TUSER', tuser)
      postRegisterId = tuser.id
      if (!postRegisterId) return utils.giveup(req, res, 'Post-registration token no id')
    } catch (e) {
      return utils.giveup(req, res, 'Failed post-registration token validation')
    }
  }

  if (postRegisterId || (recaptchaResponseToken === process.env.RECAPTCHA_BYPASS)) {
    authenticate(postRegisterId)
    return
  }

  const verificationURL = 'https://www.google.com/recaptcha/api/siteverify?secret=' + process.env.RECAPTCHA_SECRET_KEY + '&response=' + recaptchaResponseToken + '&remoteip=' + req.userip

  needle.get(verificationURL, function (er, response, body) {
    logger.log4req(req, 'recaptchad', body)

    if (body.success !== undefined && !body.success) {
      return utils.giveup(req, res, 'Failed captcha verification')
    }

    authenticate()
  })
}

/// ///////////////////
/* POST: HANDLE REGISTER ATTEMPT, using given passport
   Simply creates user: if successful, caller must then do login
*/
async function register (req, res, next) {
  console.log('register')
  if (!('username' in req.body) || (req.body.username.trim().length === 0)) return utils.giveup(req, res, 'username not given')
  const username = req.body.username.trim()
  let name = username
  if (('name' in req.body) && (req.body.name.trim().length > 0)) {
    name = req.body.name.trim()
  }

  if (!('password' in req.body) || (req.body.password.trim().length === 0)) return utils.giveup(req, res, 'password not given')
  if (!('email' in req.body) || (req.body.email.trim().length === 0)) return utils.giveup(req, res, 'email not given')
  const recaptchaResponseToken = getRecaptchaResponse(req)
  if (!recaptchaResponseToken) return utils.giveup(req, res, 'recaptcha not given')

  const email = req.body.email.trim()
  if (!isEmail(email)) return utils.giveup(req, res, 'Not a valid email address')

  console.log('register', name)

  async function createuser () {
    const params = {
      name,
      username,
      password: await bcrypt.hash(req.body.password.trim(), saltRounds),
      email
    }
    try {
      // Although username must be unique, explicitly check first
      const existingusername = await models.users.findOne({ where: { username } })
      if (existingusername) {
        return utils.giveup(req, res, 'username already in use')
      }
      const existingemail = await models.users.findOne({ where: { email: params.email } })
      if (existingemail) {
        return utils.giveup(req, res, 'email already in use')
      }

      // Create user now
      const dbuser = await models.users.create(params) // Transaction ??
      if (!dbuser) return utils.giveup(req, res, 'user not created')

      // Tell owner that new user needs roles added
      const dbsite = await models.sites.findByPk(req.site.id)
      const dbpubs = await dbsite.getPubs()
      for (const dbpub of dbpubs) {
        let anyRoleRequested = false
        const dbuserRequestedRoles = await dbpub.getPubroles({ where: { userRequested: true } })
        if (dbuserRequestedRoles.length > 0) {
          await dbpub.addUser(dbuser)
          for (const dbpubrole of dbuserRequestedRoles) {
            await dbpubrole.addUser(dbuser) // Transaction ??
            anyRoleRequested = true
          }
        }
        if (anyRoleRequested) {
          // Send per-pub user-just-registered mail
          const dbpubmails2 = await dbpub.getMailTemplates({ where: { sendOnSiteAction: models.pubmailtemplates.consts.SITE_REGISTER } })
          for (const dbpubmail of dbpubmails2) {
            if (dbpubmail.bccToOwners) { // CHANGE
              console.log(dbpubmail.id, 'SEND REGISTERED MAIL TO OWNER', dbpub.id)
              await mailutils.sendOneTemplate(dbuser.id, dbpubmail, false, dbpub, false, dbuser, false, false, false, false)
            }
          }
        }
      }

      // Send site-wide welcome mail
      const dbpubmails = await models.pubmailtemplates.findAll({
        where: {
          pubId: null,
          sendOnSiteAction: models.pubmailtemplates.consts.SITE_REGISTER
        }
      })
      for (const dbpubmail of dbpubmails) {
        if (dbpubmail.sendToUser) {
          await mailutils.sendOneTemplate(dbuser.id, dbpubmail, req.site, false, false, dbuser, false, false, false, false)
        }
      }

      // Always send mail to site owner
      utils.asyncMail(false, req.site.name + '. API User registered: ' + username, 'Name: ' + params.name + '\r\nEmail: ' + params.email)

      const token = jwt.sign({ id: dbuser.id }, process.env.JWT_SECRET)
      console.log('REGISTERED', dbuser.id)
      utils.returnOK(req, res, { token }, 'user')
    } catch (e) {
      logger.log(e.message)
      utils.giveup(req, res, 'Could not create user')
    }
  }

  if (recaptchaResponseToken === process.env.RECAPTCHA_BYPASS) {
    createuser()
    return
  }

  const verificationURL = 'https://www.google.com/recaptcha/api/siteverify?secret=' + process.env.RECAPTCHA_SECRET_KEY + '&response=' + recaptchaResponseToken + '&remoteip=' + req.userip

  needle.get(verificationURL, function (er, response, body) {
    logger.log4req(req, 'recaptchad', body)

    if (body.success !== undefined && !body.success) {
      return utils.giveup(req, res, 'Failed captcha verification')
    }

    createuser()
  })
}

/// ///////////////////
/* ALL: CHECK LOGGED IN */
// Must be logged in from now on
// req.ppuser is passport user
function loaduser (req, res, next) {
  // console.log('CHECK LOGGED IN', req.headers['authorization'])

  passport.authenticate('jwt', { session: false },
    async (err, ppuser, info) => {
      if (ppuser) {
        // DOUBLE-CHECK THAT USER OK?
        let dbuser = await models.users.findByPk(ppuser.id)
        if (!dbuser) {
          logger.log4req(req, 'Stale login', ppuser.id)
          return utils.giveup(req, res, 'Stale login')
        }
        if (dbuser.super && dbuser.actas > 0) {
          console.log('MASQUERADING AS', dbuser.actas)
          const actas = await models.users.findByPk(dbuser.actas)
          if (actas) {
            actas.actas = dbuser.id
            dbuser = actas
          }
        }
        req.dbuser = dbuser
        const newppuser = { id: dbuser.id }
        if (!_lang.isEqual(newppuser, ppuser)) {
          console.log('AUTH LOADUSER ppuser refreshed', newppuser, ppuser)
        }
        req.ppuser = newppuser
        logger.log4req(req, 'User', req.dbuser.username, req.url)
        next()
        return
      }
      logger.log4req(req, 'LOGIN TOKEN FAIL', err, info)
      return utils.giveup(req, res, 'Not logged in')
    }
  )(req, res, next)
}

/* DELETE: LOGOUT */
async function logout (req, res) {
  if (req.dbuser.actas > 0) { // If this is super masquerading as user
    try {
      logger.log4req(req, 'Stopping masquerade')
      const dbsuper = await models.users.findByPk(req.dbuser.actas)
      if (dbsuper) {
        dbsuper.actas = 0
        await dbsuper.save() // Transaction ??
      }
    } catch (e) {
      console.log('logout clear actas fail', e.message)
    }
  }

  logger.log4req(req, 'Logging out ', req.ppuser.id, req.dbuser.username)
  req.logout(function () {
    utils.returnOK(req, res, 'Logged out')
  })
}

/* GET: GETUSER */
function getuser (req, res) {
  logger.log4req(req, 'getuser')
  if (!req.ppuser) return utils.giveup(req, res, 'Not logged in unexpectedly')
  // console.log(req.ppuser)

  const rvuser = {
    id: req.dbuser.id,
    username: req.dbuser.username,
    name: req.dbuser.name,
    email: req.dbuser.email,
    super: req.dbuser.super,
    publicsettings: req.site.publicsettings,
    sitepages: req.site.sitepages
  }
  utils.returnOK(req, res, rvuser, 'user')
}

/* POST+PATCH: SAVEUSER */
async function saveuser (req, res, next) {
  if (!('x-http-method-override' in req.headers)) return utils.giveup(req, res, 'No x-http-method-override')
  if (req.headers['x-http-method-override'] !== 'PATCH') return utils.giveup(req, res, 'Not patch')

  try {
    if (!req.ppuser) return utils.giveup(req, res, 'Not logged in unexpectedly')

    let name = false
    if (('name' in req.body) && (req.body.name.trim().length > 0)) name = req.body.name.trim()
    let email = false
    if (('email' in req.body) && (req.body.email.trim().length > 0)) {
      email = req.body.email.trim()
      if (!isEmail(email)) return utils.giveup(req, res, 'Not a valid email address')
    }
    let password = false
    if (('password' in req.body) && (req.body.password.trim().length > 0)) password = req.body.password.trim()
    if (password) {
      password = await bcrypt.hash(password, saltRounds)
    }

    if (!name && !email && !password) return utils.giveup(req, res, 'No changed user params')
    if (name) req.dbuser.name = name
    if (email) req.dbuser.email = email
    if (password) req.dbuser.password = password
    await req.dbuser.save() // Transaction OK
    logger.log4req(req, 'auth saveuser OK')
    utils.returnOK(req, res, 'User updated')
  } catch (error) {
    console.log(error)
    return utils.exterminate(req, res, error)
  }
}

/* POST: FORGOTPWD */
async function forgotpwd (req, res, next) {
  try {
    if (!('email' in req.body)) return utils.giveup(req, res, 'No email given')
    const recaptchaResponseToken = getRecaptchaResponse(req)
    if (!recaptchaResponseToken) return utils.giveup(req, res, 'recaptcha not given')

    const email = req.body.email.trim()
    logger.log4req(req, 'forgotpwd request', email)

    async function doforgotpwd () {
      const dbuser = await models.users.findOne({ where: { email } })
      const forgotten = { err: false, msg: false }
      if (!dbuser) {
        forgotten.err = 'Email not found'
      } else {
        const buf = crypto.randomBytes(20)
        dbuser.resettoken = buf.toString('hex')
        dbuser.resetexpires = Date.now() + 3600000
        dbuser.save() // Transaction ??

        const dbpubmails = await models.pubmailtemplates.findAll({
          where: {
            pubId: null,
            sendOnSiteAction: models.pubmailtemplates.consts.SITE_FORGOTPWD
          }
        })

        for (const dbpubmail of dbpubmails) {
          console.log(dbpubmail.id, 'SEND FORGOT PASSWORD MAIL', email)
          if (dbpubmail.sendToUser) {
            // {{site.url}}/resetpwd?{{resettokens}}
            const data = {
              resettokens: dbuser.resettoken // Don't use eg t= as = gets mangled sometimes in plain text to &#x3D;
            }
            await mailutils.sendOneTemplate(dbuser.id, dbpubmail, req.site, false, false, dbuser, false, false, false, false, data)
          }
        }

        forgotten.msg = 'Password reset email sent. The link will expire in an hour.'
        if (process.env.TESTING) forgotten.resettoken = dbuser.resettoken
      }
      // console.log('forgotten', forgotten)
      utils.returnOK(req, res, forgotten, 'forgotten')
    }

    if (recaptchaResponseToken === process.env.RECAPTCHA_BYPASS) {
      doforgotpwd()
      return
    }

    const verificationURL = 'https://www.google.com/recaptcha/api/siteverify?secret=' + process.env.RECAPTCHA_SECRET_KEY + '&response=' + recaptchaResponseToken + '&remoteip=' + req.userip

    needle.get(verificationURL, function (er, response, body) {
      logger.log4req(req, 'recaptchad', body)

      if (body.success !== undefined && !body.success) {
        return utils.giveup(req, res, 'Failed captcha verification')
      }

      doforgotpwd()
    })
  } catch (error) {
    console.log(error)
    return utils.exterminate(req, res, error)
  }
}

module.exports = {
  passport,
  login,
  register,
  logout,
  getuser,
  saveuser,
  loaduser,
  forgotpwd
}
