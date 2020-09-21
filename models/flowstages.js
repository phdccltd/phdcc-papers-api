//  Created after all models made
//    flowId:
//      flow.getFlowStages
//      flowstage.getFlow

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    weight: { type: Sequelize.INTEGER, allowNull: false },
    name: { type: Sequelize.STRING(50), allowNull: false },
  }
  const flowstages = sequelize.define('flowstages', fields)
  flowstages.fields = fields

  flowstages.associate = function (dbs) {
    // Adds flowstages.flowId Sequelize.INTEGER allowNull:false
    dbs.flows.hasMany(dbs.flowstages, { as: 'FlowStages', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flow while flowstages exist
    dbs.flowstages.belongsTo(dbs.flows, { foreignKey: { allowNull: false }})

    dbs.flowstages.belongsTo(dbs.pubroles, { foreignKey: { allowNull: false } }) // Must have this role to submit. Might need multiple in future

    dbs.flowstages.fields.pubroleId = true
 }

  return flowstages
}
