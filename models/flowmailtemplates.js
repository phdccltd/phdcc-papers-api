
const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING(100), allowNull: false },
    subject: { type: Sequelize.STRING, allowNull: false },
    body: { type: Sequelize.TEXT, allowNull: false },
  }
  const flowmailtemplates = sequelize.define('flowmailtemplates', fields)
  flowmailtemplates.fields = fields

  flowmailtemplates.associate = function (dbs) {
    // Adds flowmailtemplates.flowId Sequelize.INTEGER allowNull:false
    dbs.flows.hasMany(dbs.flowmailtemplates, { as: 'FlowMailTemplates', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flow while flowmailtemplates exist
    dbs.flowmailtemplates.belongsTo(dbs.flows, { foreignKey: { allowNull: false }})
 }

  return flowmailtemplates
}
