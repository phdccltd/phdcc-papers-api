//  Created after all models made
//    siteId:
//      site.getSitePages
//      sitepage.getSite

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    path: { type: Sequelize.STRING, allowNull: false },
    title: { type: Sequelize.STRING, allowNull: false },
    content: { type: Sequelize.TEXT, allowNull: false },
  }
  const sitepages = sequelize.define('sitepages', fields)
  sitepages.fields = fields

  sitepages.associate = function (dbs) {
    // Adds sitepages.siteId Sequelize.INTEGER allowNull:false
    dbs.sites.hasMany(dbs.sitepages, { as: 'SitePages', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete site while sitepages exist
    dbs.sitepages.belongsTo(dbs.sites, { foreignKey: { allowNull: false }})
  }

  return sitepages
}
