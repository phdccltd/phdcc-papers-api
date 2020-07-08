//  Created after all models made
//    flowId:
//      flow.getFlowStatuses
//      flowstatus.getFlow

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const flowstatuses = sequelize.define('flowstatuses', {
    // id, createdAt and updatedAt: added automatically
    weight: { type: Sequelize.INTEGER, allowNull: false },
    status: { type: Sequelize.STRING(50), allowNull: false },
    ended: { type: DataTypes.BOOLEAN, allowNull: false },
  })

  flowstatuses.associate = function (dbs) {
    // Adds flowstatuses.flowId Sequelize.INTEGER allowNull:false
    dbs.flows.hasMany(dbs.flowstatuses, { onDelete: 'RESTRICT' })  // Cannot delete flow while flowstatuses exist
    dbs.flowstatuses.belongsTo(dbs.flows)
 }

  return flowstatuses
}
