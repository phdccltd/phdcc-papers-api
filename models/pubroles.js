const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING(100), allowNull: false },
    isowner: { type: DataTypes.BOOLEAN, allowNull: false, default: false },
    defaultrole: { type: DataTypes.BOOLEAN, allowNull: false },
    isreviewer: { type: DataTypes.BOOLEAN, allowNull: false },
}
  const pubroles = sequelize.define('pubroles', fields)
  pubroles.fields = fields

  pubroles.associate = function (dbs) {
    // Adds pubroles.pubId Sequelize.INTEGER allowNull:false
    dbs.pubs.hasMany(dbs.pubroles, { foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete pub while pubroles exist
    dbs.pubroles.belongsTo(dbs.pubs, { foreignKey: { allowNull: false } })

    dbs.pubroles.fields.pubId = true
 }

  return pubroles
}
