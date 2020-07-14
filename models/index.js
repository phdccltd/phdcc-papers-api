'use strict'

console.log('MODELS')

const fs = require('fs')
const path = require('path')
const Sequelize = require('sequelize')
const basename = path.basename(__filename)

const dbs = {}

const sequelize = require('../db').sequelize

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js'
    )
  })
  .forEach((file) => {
    console.log('models', file)
    const model = sequelize.import(path.join(__dirname, file))
    dbs[model.name] = model
  })

Object.keys(dbs).forEach((modelName) => {
  if (dbs[modelName].associate) {
    dbs[modelName].associate(dbs)
  }
})

dbs.sequelize = sequelize

dbs.sanitise = (model, dbobj) => {
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


module.exports = dbs
