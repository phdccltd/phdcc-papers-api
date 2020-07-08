//  Created after all models made
//    flowId:
//      flow.getFlowAccepting
//      flowaccepting.getFlow
//    flowstageId:

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const flowacceptings = sequelize.define('flowacceptings', {
    // id, createdAt and updatedAt: added automatically
    open: { type: DataTypes.BOOLEAN, allowNull: false },
  })

  flowacceptings.associate = function (dbs) {
    // Adds flowacceptings.flowId Sequelize.INTEGER allowNull:false
    dbs.flows.hasMany(dbs.flowacceptings, { onDelete: 'RESTRICT' })  // Cannot delete flow while flowacceptings exist
    dbs.flowacceptings.belongsTo(dbs.flows)
    // Adds flowacceptings.flowstageId Sequelize.INTEGER allowNull:false
    dbs.flowstages.hasMany(dbs.flowacceptings, { onDelete: 'RESTRICT' })  // Cannot delete flowstage while flowacceptings exist
    dbs.flowacceptings.belongsTo(dbs.flowstages)
 }

  return flowacceptings
}
