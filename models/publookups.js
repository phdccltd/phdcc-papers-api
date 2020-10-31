//  Created after all models made

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING, allowNull: false }
  }
  const publookups = sequelize.define('publookups', fields)
  publookups.fields = fields

  publookups.associate = function (dbs) {
    // Adds publookups.pubId Sequelize.INTEGER allowNull:false
    dbs.pubs.hasMany(dbs.publookups, { as: 'PubLookups', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' }) // Cannot delete pub while publookups exist
    dbs.publookups.belongsTo(dbs.pubs, { foreignKey: { allowNull: false } })
  }

  return publookups
}
