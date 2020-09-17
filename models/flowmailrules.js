// FlowMailRules
//
// Trigger for when fired
// - flowstatusId: when this status assigned
// - flowgradeId: when this grade added
//
// Who to send it to
// - Author
// - Role
// - submitting user
// - bcc owners

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING(50), allowNull: false },
    sendToAuthor: { type: DataTypes.BOOLEAN, allowNull: false },
    bccToOwners: { type: DataTypes.BOOLEAN, allowNull: false },
    sendToUser: { type: DataTypes.BOOLEAN, allowNull: false },
    // sendToRole: defined by pubroleId below
  }
  const flowmailrules = sequelize.define('flowmailrules', fields)
  flowmailrules.fields = fields

  flowmailrules.associate = function (dbs) {
    // Adds flowmailrules.flowmailtemplateId Sequelize.INTEGER allowNull:false
    dbs.flowmailtemplates.hasMany(dbs.flowmailrules, { as: 'FlowMailRules', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flowmailtemplate while flowmailrules exist
    dbs.flowmailrules.belongsTo(dbs.flowmailtemplates, { foreignKey: { allowNull: false }})
    dbs.flowstatuses.hasMany(dbs.flowmailrules, { as: 'FlowMailRules', foreignKey: { allowNull: true }, onDelete: 'RESTRICT' })  // Cannot delete flowstatus while flowmailrules exist
    dbs.flowmailrules.belongsTo(dbs.flowstatuses, { foreignKey: { allowNull: true } }) // flowstatusId (Trigger)

    dbs.flowgrades.hasMany(dbs.flowmailrules, { as: 'FlowMailRules', foreignKey: { allowNull: true }, onDelete: 'RESTRICT' })  // Cannot delete flowgrade while flowmailrules exist
    dbs.flowmailrules.belongsTo(dbs.flowgrades, { foreignKey: { allowNull: true } }) // flowgradeId (Trigger)

    dbs.flowmailrules.belongsTo(dbs.pubroles, { foreignKey: { allowNull: true } }) // pubroleId (Recipients)
 }

  return flowmailrules
}
