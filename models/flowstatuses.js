//  Created after all models made
//    flowId:
//      flow.getFlowStatuses
//      flowstatus.getFlow

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    weight: { type: Sequelize.INTEGER, allowNull: false },
    status: { type: Sequelize.STRING(50), allowNull: false },
    ended: { type: DataTypes.BOOLEAN, allowNull: false },
    visibletoauthor: { type: DataTypes.BOOLEAN, allowNull: false },
    owneradvice: { type: Sequelize.STRING, allowNull: false },            // Shown to owner if this is the most recent status
    // Don't bother making as FK:
    submittedflowstageId: { type: Sequelize.INTEGER, allowNull: true },  // If this type of entry submitted, add this status
    cansubmitflowstageId: { type: Sequelize.INTEGER, allowNull: true },  // If at this status, then this stage can be submitted
  }
  const flowstatuses = sequelize.define('flowstatuses', fields)
  flowstatuses.fields = fields

  flowstatuses.associate = function (dbs) {
    // Adds flowstatuses.flowId Sequelize.INTEGER allowNull:false
    dbs.flows.hasMany(dbs.flowstatuses, { as: 'FlowStatuses', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flow while flowstatuses exist
    dbs.flowstatuses.belongsTo(dbs.flows, { foreignKey: { allowNull: false }})
 }

  return flowstatuses
}
