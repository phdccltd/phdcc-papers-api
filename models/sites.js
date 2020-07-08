//  Created in confs.js:
//    conf.siteid:
//      site.getConfs
//      conf.getSite

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const sites = sequelize.define('sites', {
    // id, createdAt and updatedAt: added automatically
    url: { type: Sequelize.STRING, allowNull: false },
    name: { type: Sequelize.STRING(50), allowNull: false },
    settings: { type: Sequelize.TEXT, allowNull: true } // JSON-encoded: Recaptcha-Site-key, Recaptcha-Secret-key
  })

  //sites.associate = function (models) {}

  return sites
}
