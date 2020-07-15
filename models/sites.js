//  Created in pubs.js:
//    pub.siteid:
//      site.getPubs
//      pub.getSite

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const sites = sequelize.define('sites', {
    // id, createdAt and updatedAt: added automatically
    url: { type: Sequelize.STRING, allowNull: false },
    name: { type: Sequelize.STRING(50), allowNull: false },
    privatesettings: { type: Sequelize.TEXT, allowNull: true }, // JSON-encoded: Recaptcha-Secret-key
    publicsettings: { type: Sequelize.TEXT, allowNull: true } // JSON-encoded: Recaptcha-Site-key
  })

  //sites.associate = function (models) {}

  return sites
}
