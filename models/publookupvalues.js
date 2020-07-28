//  Created after all models made

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    weight: { type: Sequelize.INTEGER, allowNull: false },
    name: { type: Sequelize.STRING, allowNull: false },
  }
  const publookupvalues = sequelize.define('publookupvalues', fields)
  publookupvalues.fields = fields

  publookupvalues.associate = function (dbs) {
    // Adds publookupvalues.publookupId Sequelize.INTEGER allowNull:false
    dbs.publookups.hasMany(dbs.publookupvalues, { as: 'PubLookupValues', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete pub while publookupvalues exist
    dbs.publookupvalues.belongsTo(dbs.publookups, { foreignKey: { allowNull: false } })
 }

  return publookupvalues
}
