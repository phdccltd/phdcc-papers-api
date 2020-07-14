//  Created in userpubs.js:
//      pub.getUsers
//      pub.hasUser(req.user)
//      user.getPublicationspuberences

//  Created after all models made
//    siteid:
//      site.getpubs
//      pub.getSite

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    alias: { type: Sequelize.STRING(50), allowNull: false },
    name: { type: Sequelize.STRING(50), allowNull: false },
    title: { type: Sequelize.STRING, allowNull: false },
    startdate: { type: Sequelize.DATEONLY, allowNull: true },
    email: { type: Sequelize.STRING, allowNull: false },
    tz: { type: Sequelize.STRING(50), allowNull: true },
  }
  const pubs = sequelize.define('pubs', fields)
  pubs.fields = fields

  pubs.associate = function (dbs) {
    // Adds pubs.siteId Sequelize.INTEGER allowNull:false
    dbs.sites.hasMany(dbs.pubs, { onDelete: 'RESTRICT' })  // Cannot delete site while pubs exist
    dbs.pubs.belongsTo(dbs.sites)
    dbs.pubs.fields.siteId = true
  }

  return pubs
}
