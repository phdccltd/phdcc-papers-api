//  Created after all models made
//    confId:
//      conf.getFlows
//      flow.getConf

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const flows = sequelize.define('flows', {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING(50), allowNull: false },
  })

  flows.associate = function (dbs) {
    // Adds flows.confId Sequelize.INTEGER allowNull:false
    dbs.confs.hasMany(dbs.flows, { onDelete: 'RESTRICT' })  // Cannot delete conf while flows exist
    dbs.flows.belongsTo(dbs.confs)
 }

  return flows
}
