//  Created after all models made
//    userid, siteid:
//      pub.getUsers
//      pub.hasUser(req.user)
//      user.getPublications

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const userpubs = sequelize.define('userpubs', {
    // id NOT created
    // createdAt and updatedAt: added automatically
  })

  userpubs.associate = function (dbs) {
    // Adds userpubs.userid: Sequelize.INTEGER allowNull:false
    // Adds userpubs.siteid: Sequelize.INTEGER allowNull:false
    dbs.users.belongsToMany(dbs.pubs, {
      as: 'Publications',
      through: dbs.userpubs,
      foreignKey: 'userid'
    }) // becomes user.getPublications
    dbs.pubs.belongsToMany(dbs.users, {
      as: 'Users',
      through: dbs.userpubs,
      foreignKey: 'pubid'
    }) // becomes pub.getUsers
  }

  return userpubs
}
