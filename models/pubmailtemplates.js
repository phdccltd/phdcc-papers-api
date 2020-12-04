
const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    weight: { type: Sequelize.INTEGER, allowNull: false },
    name: { type: Sequelize.STRING(100), allowNull: false },
    subject: { type: Sequelize.STRING, allowNull: false },
    body: { type: Sequelize.TEXT, allowNull: false },

    // When to send:
    // -flowstageId - defined below
    // -flowstatusId - defined below
    // -flowgradeId - defined below
    sendReviewReminderDays: { type: Sequelize.INTEGER, allowNull: false },
    sendLeadReminderDays: { type: Sequelize.INTEGER, allowNull: false },
    sendReviewChaseUpDays: { type: Sequelize.INTEGER, allowNull: false },
    sendOnSiteAction: { type: DataTypes.INTEGER, allowNull: false }, // See consts below
    sendOnRoleGiven: { type: Sequelize.INTEGER, allowNull: false },
    // Who to send to:
    sendToAuthor: { type: DataTypes.BOOLEAN, allowNull: false },
    bccToOwners: { type: DataTypes.BOOLEAN, allowNull: false },
    sendToUser: { type: DataTypes.BOOLEAN, allowNull: false },
    sendToReviewers: { type: DataTypes.BOOLEAN, allowNull: false }
    // sendToRole: defined by pubroleId below
  }
  const pubmailtemplates = sequelize.define('pubmailtemplates', fields)
  pubmailtemplates.fields = fields

  pubmailtemplates.associate = function (dbs) {
    // Adds pubmailtemplates.pubId Sequelize.INTEGER allowNull:false
    dbs.pubs.hasMany(dbs.pubmailtemplates, { as: 'MailTemplates', foreignKey: { allowNull: true }, onDelete: 'RESTRICT' }) // Cannot delete pub while pubmailtemplates exist
    dbs.pubmailtemplates.belongsTo(dbs.pubs, { foreignKey: { allowNull: true } })

    dbs.flowstages.hasMany(dbs.pubmailtemplates, { as: 'PubMails', foreignKey: { allowNull: true }, onDelete: 'RESTRICT' }) // Cannot delete flowstage while pubmailtemplates exist
    dbs.pubmailtemplates.belongsTo(dbs.flowstages, { foreignKey: { allowNull: true } }) // flowstageId (Trigger)

    dbs.flowstatuses.hasMany(dbs.pubmailtemplates, { as: 'PubMails', foreignKey: { allowNull: true }, onDelete: 'RESTRICT' }) // Cannot delete flowstatus while pubmailtemplates exist
    dbs.pubmailtemplates.belongsTo(dbs.flowstatuses, { foreignKey: { allowNull: true } }) // flowstatusId (Trigger)

    dbs.flowgrades.hasMany(dbs.pubmailtemplates, { as: 'PubMails', foreignKey: { allowNull: true }, onDelete: 'RESTRICT' }) // Cannot delete flowgrade while pubmailtemplates exist
    dbs.pubmailtemplates.belongsTo(dbs.flowgrades, { foreignKey: { allowNull: true } }) // flowgradeId (Trigger)

    dbs.pubmailtemplates.belongsTo(dbs.pubroles, { foreignKey: { allowNull: true } }) // pubroleId (Recipients)
  }

  pubmailtemplates.consts = { // sendOnSiteAction constants
    SITE_REGISTER: 1,
    SITE_FORGOTPWD: 2,
    SITE_PWDRESET: 3
  }

  return pubmailtemplates
}
