//  Created after all models made
//    userid, siteid:
//      conf.getUsers
//      conf.hasUser(req.user)
//      user.getConferences

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const userconfs = sequelize.define('userconfs', {
    // id NOT created
    // createdAt and updatedAt: added automatically
  })

  userconfs.associate = function (dbs) {
    // Adds userconfs.userid: Sequelize.INTEGER allowNull:false
    // Adds userconfs.siteid: Sequelize.INTEGER allowNull:false
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

  }

  return userconfs
}
