const { Router } = require('express')
const models = require('../models')
const utils = require('../utils')

const router = Router()

/* GET pubs listing. */
router.get('/pubs', async function (req, res, next) {
  console.log('GET /pubs')

  try {
    const order = {
      order: [
        ['startdate', 'ASC']
      ]
    }
    let dbpubs = false
    if (req.user.super) {
      dbpubs = await models.pubs.findAll(order)
    } else {
      // TODO: CHECK ACCESS RIGHTS???
      dbpubs = await req.user.getPublications(order)
    }

    const pubs = []
    for (const dbpub of dbpubs) {
      pubs.push(models.sanitise(models.pubs, dbpub))
    }
    utils.returnOK(req, res, pubs, 'pubs')
  } catch (e) {
    utils.giveup(req, res, e.message)
  }
})


/* GET pub by ID. */
router.get('/pubs/:id', async function (req, res, next) {
  // TODO: Check access - is user allowed to access this publication?
  const id = parseInt(req.params.id)
  console.log('GET /pubs', id)
  const dbpub = await models.pubs.findByPk(id)
  if (dbpub) {
    const pub = models.sanitise(models.pubs, dbpub)
    utils.returnOK(req, res, pub, 'pub')
  } else {
    utils.giveup(req, res, 'Invalid pubs:id')
  }
})

/*
app.get('/', (req, res) => {
  return res.send('Received a GET HTTP method');
});

app.post('/', (req, res) => {
  return res.send('Received a POST HTTP method');
});

app.put('/', (req, res) => {
  return res.send('Received a PUT HTTP method');
});

app.delete('/', (req, res) => {
  return res.send('Received a DELETE HTTP method');
});
*/

module.exports = router
