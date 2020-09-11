const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    comment: { type: Sequelize.TEXT, allowNull: false },
    canreview: { type: DataTypes.BOOLEAN, allowNull: false },
    dt: { type: Sequelize.DATE, allowNull: false },
  }
  const submitgradings = sequelize.define('submitgradings', fields)
  submitgradings.fields = fields

  submitgradings.associate = function (dbs) {
    // Adds entries.submitId Sequelize.INTEGER allowNull:false
    dbs.submits.hasMany(dbs.submitgradings, { as: 'Gradings', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete submit while submitgradings exist
    dbs.submitgradings.belongsTo(dbs.submits, { foreignKey: { allowNull: false }})

    dbs.submitgradings.belongsTo(dbs.flowgrades, { foreignKey: { allowNull: false } })

    dbs.submitgradings.belongsTo(dbs.users, { foreignKey: { allowNull: false } })

    dbs.submitgradings.belongsTo(dbs.flowgradescores, { foreignKey: { allowNull: false } })

    dbs.submitgradings.fields.flowgradeId = true
    dbs.submitgradings.fields.userId = true
    dbs.submitgradings.fields.flowgradescoreId = true
}

  return submitgradings
}
