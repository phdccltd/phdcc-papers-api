//  Created after all models made
// formfieldId
// entryId

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    string: { type: Sequelize.STRING, allowNull: true },
    text: { type: Sequelize.TEXT, allowNull: true },
    integer: { type: Sequelize.INTEGER, allowNull: true },
    file: { type: Sequelize.STRING, allowNull: true }
  }
  const entryvalues = sequelize.define('entryvalues', fields)
  entryvalues.fields = fields

  entryvalues.associate = function (dbs) {
    // Adds entryvalues.formfieldId Sequelize.INTEGER allowNull:false
    dbs.formfields.hasMany(dbs.entryvalues, { foreignKey: { allowNull: false }, onDelete: 'RESTRICT' }) // Cannot delete formfield while entryvalues exist
    dbs.entryvalues.belongsTo(dbs.formfields, { foreignKey: { allowNull: false } })
    // Adds entryvalues.entryId Sequelize.INTEGER allowNull:false
    dbs.entries.hasMany(dbs.entryvalues, { as: 'EntryValues', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' }) // Cannot delete entry while entryvalues exist
    dbs.entryvalues.belongsTo(dbs.entries, { foreignKey: { allowNull: false } })

    dbs.entryvalues.fields.formfieldId = true
    dbs.entryvalues.fields.entryId = true
  }

  return entryvalues
}
