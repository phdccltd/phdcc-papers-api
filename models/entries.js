//  Created after all models made
//    submitId:
//      submit.getEntries
//      entry.getSubmit
//    flowstageId:

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    dt: { type: Sequelize.DATE, allowNull: false }
  }
  const entries = sequelize.define('entries', fields)
  entries.fields = fields

  entries.associate = function (dbs) {
    // Adds entries.submitId Sequelize.INTEGER allowNull:false
    dbs.submits.hasMany(dbs.entries, { as: 'Entries', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' }) // Cannot delete submit while entries exist
    dbs.entries.belongsTo(dbs.submits, { foreignKey: { allowNull: false } })
    dbs.flowstages.hasMany(dbs.entries, { foreignKey: { allowNull: false }, onDelete: 'RESTRICT' }) // Cannot delete flowstage while entries exist
    dbs.entries.belongsTo(dbs.flowstages, { foreignKey: { allowNull: false } })

    dbs.entries.fields.flowstageId = true
  }

  return entries
}
