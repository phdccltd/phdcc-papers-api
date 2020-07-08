//  Created after all models made
//    flowId:
//      flow.getSubmits
//      submit.getFlow
//    userId:
//      user.getSubmits
//      submit.getUser

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const submits = sequelize.define('submits', {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING, allowNull: false },
    startdt: { type: Sequelize.DATE, allowNull: false },
  })

  submits.associate = function (dbs) {
    // Adds submits.flowId Sequelize.INTEGER allowNull:false
    dbs.flows.hasMany(dbs.submits, { onDelete: 'RESTRICT' })  // Cannot delete flow while submits exist
    dbs.submits.belongsTo(dbs.flows)
    // Adds submits.userId Sequelize.INTEGER allowNull:false
    dbs.users.hasMany(dbs.submits, { onDelete: 'RESTRICT' })  // Cannot delete user while submits exist
    dbs.submits.belongsTo(dbs.users)
 }

  return submits
}
