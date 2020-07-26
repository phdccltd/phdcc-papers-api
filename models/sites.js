//  Created in pubs.js:
//    siteId:
//      site.getPubs
//      pub.getSite

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    url: { type: Sequelize.STRING, allowNull: false },
    name: { type: Sequelize.STRING(50), allowNull: false },
    privatesettings: { type: Sequelize.TEXT, allowNull: true }, // JSON-encoded: recaptcha-secret-key, email-from, admin-email
                                                                // "transport-sendmail": true,
                                                                // "transport-newline": "unix",
                                                                // "transport-path": "/usr/sbin/sendmail",
    publicsettings: { type: Sequelize.TEXT, allowNull: true } // JSON-encoded: recaptcha-site-key, pubscalled
  }
  const sites = sequelize.define('sites', fields)
  sites.fields = fields

  //sites.associate = function (models) {}

  return sites
}
