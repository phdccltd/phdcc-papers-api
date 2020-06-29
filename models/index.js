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

dbs.users.belongsToMany(dbs.confs, {
  as: 'Conferences',
  through: dbs.userconfs,
  foreignKey: 'userid'
}) // becomes user.getConferences
dbs.confs.belongsToMany(dbs.users, {
  as: 'Users',
  through: dbs.userconfs,
  foreignKey: 'cid'
}) // becomes conf.getUsers

// Add confs.siteId
dbs.sites.hasMany(dbs.confs, { onDelete: 'RESTRICT' })  // One site has many conferences: site.getConferences
dbs.confs.belongsTo(dbs.sites)  // Each conference has one site: conf.getSite

// Add players.teamId
//dbs.teams.hasMany(dbs.players, { onDelete: 'RESTRICT' }) // One team has many players: team.getPlayers
//dbs.players.belongsTo(dbs.teams)  // Each player has one team: player.getTeam

//Team.hasMany(Player);
//Player.belongsTo(Team);

module.exports = dbs
