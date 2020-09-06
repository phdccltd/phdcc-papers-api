const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    weight: { type: Sequelize.INTEGER, allowNull: false },
    name: { type: Sequelize.STRING(50), allowNull: false },
  }
  const flowgradescores = sequelize.define('flowgradescores', fields)
  flowgradescores.fields = fields

  flowgradescores.associate = function (dbs) {
    // Adds flowgradescores.flowId Sequelize.INTEGER allowNull:false
    dbs.flowgrades.hasMany(dbs.flowgradescores, { foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flowgrade while flowgradescores exist
    dbs.flowgradescores.belongsTo(dbs.flowgrades, { foreignKey: { allowNull: false }})
 }

  return flowgradescores
}
