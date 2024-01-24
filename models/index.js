'use strict'

console.log('MODELS')

const fs = require('fs')
const path = require('path')
const basename = path.basename(__filename)

const dbs = {}

const sequelize = require('../db')
// const Sequelize = require('sequelize')
const { DataTypes } = require('sequelize')

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js'
    )
  })
  .forEach((file) => {
    console.log('models', file)
    const model = require('./' + file)(sequelize, DataTypes)
    dbs[model.name] = model
  })

Object.keys(dbs).forEach((modelName) => {
  if (dbs[modelName].associate) {
    dbs[modelName].associate(dbs)
  }
})

dbs.sequelize = sequelize

dbs.sanitise = (model, dbobj) => {
  if (!dbobj) return dbobj
  if (model.fields) {
    const sanobj = {}
    sanobj.id = dbobj.id
    Object.keys(model.fields).forEach((field) => {
      sanobj[field] = dbobj[field]
    })
    return sanobj
  }
  return dbobj
}

dbs.sanitiselist = (dbthings, model) => {
  const sanitisedlist = []
  for (const dbthing of dbthings) {
    const thing = dbs.sanitise(model, dbthing)
    sanitisedlist.push(thing)
  }
  return sanitisedlist
}

dbs.duplicate = (model, dbobj) => {
  if (!dbobj) return null
  const dupobj = {}
  if (model.fields) {
    Object.keys(model.fields).forEach((field) => {
      dupobj[field] = dbobj[field]
    })
  }
  return dupobj
}

dbs.deleteall = async () => { // sqlite_sequence
  console.log('====dbs.deleteall START')
  const { QueryTypes } = require('sequelize')
  const sqliteTables = await sequelize.query("SELECT name FROM `sqlite_schema` WHERE type = 'table' AND name LIKE 'sqlite_%'; ", { type: QueryTypes.SELECT })
  if (sqliteTables.length > 0) { // sqlite_sequence wll exist in Sqlite3
    console.log('====dbs.deleteall SQLITE3')
    await dbs.actionlogs.destroy({ truncate: true })
    await dbs.userpubs.destroy({ truncate: true })
    await dbs.sitepages.destroy({ truncate: true })
    await dbs.pubmailtemplates.destroy({ truncate: true })
    await dbs.submitstatuses.destroy({ truncate: true })
    await dbs.submitreviewers.destroy({ truncate: true })
    await dbs.submitgradings.destroy({ truncate: true })
    await dbs.entryvalues.destroy({ truncate: true })
    await dbs.entries.destroy({ truncate: true })
    await dbs.submits.destroy({ truncate: true })
    await dbs.formfields.destroy({ truncate: true })
    await dbs.flowacceptings.destroy({ truncate: true })
    await dbs.flowstatuses.destroy({ truncate: true })
    await dbs.flowstages.destroy({ truncate: true })
    await dbs.flowgradescores.destroy({ truncate: true })
    await dbs.flowgrades.destroy({ truncate: true })
    await dbs.publookupvalues.destroy({ truncate: true })
    await dbs.publookups.destroy({ truncate: true })
    await dbs.pubuserroles.destroy({ truncate: true })
    await dbs.pubroles.destroy({ truncate: true })
    await dbs.flows.destroy({ truncate: true })
    await dbs.pubs.destroy({ truncate: true })
    await dbs.sites.destroy({ truncate: true })
    await dbs.logs.destroy({ truncate: true })
    await dbs.users.destroy({ truncate: true })
    const tables = await sequelize.query("SELECT name FROM `sqlite_schema` WHERE type = 'table' AND name NOT LIKE 'sqlite_%'; ", { type: QueryTypes.SELECT })
    for (const table of tables) {
      const count = await sequelize.query('SELECT COUNT(*) as count FROM `' + table.name + '`; ', { type: QueryTypes.SELECT })
      if (count[0].count > 0) {
        console.log('TABLE NOT RESET', table.name, count[0].count)
        throw new Error('TABLE NOT RESET: ' + table.name + ' ' + count[0].count + ' rows')
      }
    }
  }
  console.log('====dbs.deleteall END')
}

module.exports = dbs
