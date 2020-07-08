//  Created in userconfs.js:
//      conf.getUsers
//      conf.hasUser(req.user)
//      user.getConferences

//  Created after all models made
//    siteid:
//      site.getConfs
//      conf.getSite

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const confs = sequelize.define('confs', {
    // id, createdAt and updatedAt: added automatically
    alias: { type: Sequelize.STRING(50), allowNull: false },
    name: { type: Sequelize.STRING(50), allowNull: false },
    title: { type: Sequelize.STRING, allowNull: false },
    startdate: { type: Sequelize.DATEONLY, allowNull: true },
    email: { type: Sequelize.STRING, allowNull: false },
    tz: { type: Sequelize.STRING(50), allowNull: true },
  })

  confs.associate = function (dbs) {
    // Adds confs.siteId Sequelize.INTEGER allowNull:false
    dbs.sites.hasMany(dbs.confs, { onDelete: 'RESTRICT' })  // Cannot delete site while confs exist
    dbs.confs.belongsTo(dbs.sites)
  }

  return confs
}
