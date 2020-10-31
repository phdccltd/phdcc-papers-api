//  Created after all models made
//    flowId:
//      flow.getFlowAccepting
//      flowaccepting.getFlow
//    flowstageId:
//    flowstatusId:

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    open: { type: DataTypes.BOOLEAN, allowNull: false }
  }
  const flowacceptings = sequelize.define('flowacceptings', fields)
  flowacceptings.fields = fields

  flowacceptings.associate = function (dbs) {
    // Adds flowacceptings.flowId Sequelize.INTEGER allowNull:false
    dbs.flows.hasMany(dbs.flowacceptings, { as: 'FlowAcceptings', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' }) // Cannot delete flow while flowacceptings exist
    dbs.flowacceptings.belongsTo(dbs.flows, { foreignKey: { allowNull: false } })
    // Adds flowacceptings.flowstageId Sequelize.INTEGER allowNull:false
    dbs.flowstages.hasMany(dbs.flowacceptings, { foreignKey: { allowNull: false }, onDelete: 'RESTRICT' }) // Cannot delete flowstage while flowacceptings exist
    dbs.flowacceptings.belongsTo(dbs.flowstages, { foreignKey: { allowNull: false } })
    // Adds flowacceptings.flowstatusId Sequelize.INTEGER allowNull:true
    dbs.flowstatuses.hasMany(dbs.flowacceptings, { foreignKey: { allowNull: true }, onDelete: 'RESTRICT' }) // Cannot delete flowstatus while flowacceptings exist
    dbs.flowacceptings.belongsTo(dbs.flowstatuses, { foreignKey: { allowNull: true } })

    dbs.flowacceptings.fields.flowstageId = true
    dbs.flowacceptings.fields.flowstatusId = true
  }

  return flowacceptings
}
