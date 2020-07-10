//  Created after all models made
//    pubId:
//      pub.getFlows
//      flow.getPub

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const flows = sequelize.define('flows', {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING(50), allowNull: false },
  })

  flows.associate = function (dbs) {
    // Adds flows.pubId Sequelize.INTEGER allowNull:false
    dbs.pubs.hasMany(dbs.flows, { onDelete: 'RESTRICT' })  // Cannot delete pub while flows exist
    dbs.flows.belongsTo(dbs.pubs)
 }

  return flows
}
