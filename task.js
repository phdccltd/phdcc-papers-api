const Sequelize = require('sequelize')
const _ = require('lodash/core')
const models = require('./models')
const utils = require('./utils')
const logger = require('./logger')

let started = false

/* ************************ */

async function async_startup() {
  try {
    await utils.async_sleep(1000) // Let startup pushes get out
  }
  catch (e) {
  }
}

/* ************************ */

async function async_runBackground() {
  const now = new Date();
  const nowms = now.getTime();  // getTime is in UTC

  console.log("runBackground START UTC: ", now)
  try {
  }
  catch (e) {
    console.log(e.message)
    logger.log(__filename, "async_runBackground", e.message);
  }

}

/* ************************ */

async function background(app) {

  try {
    if (!started) {
      started = true
      console.log("background started start")
      await async_startup()  // async and then calls runBackground()
    }
    await async_runBackground()
  }
  catch (e) {
    console.log(__filename, e)
    logger.log(__filename, "background:", e)
  }
}

/* ************************ */

module.exports = background;
