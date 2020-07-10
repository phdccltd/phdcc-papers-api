//  Created after all models made
//    flowId:
//      flow.getFlowStages
//      flowstage.getFlow

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const flowstages = sequelize.define('flowstages', {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING(50), allowNull: false },
  })

  flowstages.associate = function (dbs) {
    // Adds flowstages.flowId Sequelize.INTEGER allowNull:false
    dbs.flows.hasMany(dbs.flowstages, { onDelete: 'RESTRICT' })  // Cannot delete flow while flowstages exist
    dbs.flowstages.belongsTo(dbs.flows)
 }

  return flowstages
}
