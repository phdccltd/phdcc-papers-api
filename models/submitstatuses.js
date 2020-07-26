//  Created after all models made
//    submitId:
//      submit.getStatuses
//      submitstatus.getSubmit
//    flowstageId:

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
  }
  const submitstatuses = sequelize.define('submitstatuses', fields)
  submitstatuses.fields = fields

  submitstatuses.associate = function (dbs) {
    // Adds entries.submitId Sequelize.INTEGER allowNull:false
    dbs.submits.hasMany(dbs.submitstatuses, { as: 'Statuses', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete submit while submitstatuses exist
    dbs.submitstatuses.belongsTo(dbs.submits, { foreignKey: { allowNull: false }})
    dbs.flowstatuses.hasMany(dbs.submitstatuses, { foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flowstatus while submitstatuses exist
    dbs.submitstatuses.belongsTo(dbs.flowstatuses, { foreignKey: { allowNull: false } })

    dbs.submitstatuses.fields.flowstatusId = true
 }

  return submitstatuses
}
