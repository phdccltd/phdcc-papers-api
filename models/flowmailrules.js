
const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING(50), allowNull: false },
    sendToAuthor: { type: DataTypes.BOOLEAN, allowNull: false },
    bccToOwners: { type: DataTypes.BOOLEAN, allowNull: false },
  }
  const flowmailrules = sequelize.define('flowmailrules', fields)
  flowmailrules.fields = fields

  flowmailrules.associate = function (dbs) {
    // Adds flowmailrules.flowmailtemplateId Sequelize.INTEGER allowNull:false
    dbs.flowmailtemplates.hasMany(dbs.flowmailrules, { as: 'FlowMailRules', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flowmailtemplate while flowmailrules exist
    dbs.flowmailrules.belongsTo(dbs.flowmailtemplates, { foreignKey: { allowNull: false }})
    dbs.flowstatuses.hasMany(dbs.flowmailrules, { as: 'FlowMailRules', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flowmailtemplate while flowstatuses exist
    dbs.flowmailrules.belongsTo(dbs.flowstatuses, { foreignKey: { allowNull: false } })

    dbs.flowmailrules.belongsTo(dbs.pubroles, { foreignKey: { allowNull: true } }) // pubroleId
 }

  return flowmailrules
}
