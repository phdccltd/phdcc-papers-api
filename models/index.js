'use strict'

console.log('MODELS')

const fs = require('fs')
const path = require('path')
const basename = path.basename(__filename)

const dbs = {}

const sequelize = require('../db').sequelize
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

module.exports = dbs
