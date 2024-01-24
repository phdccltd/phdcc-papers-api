const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    roleids: { type: Sequelize.STRING(100), allowNull: false },
    text: { type: Sequelize.TEXT, allowNull: true }
  }
  const pubrolemessages = sequelize.define('pubrolemessages', fields)
  pubrolemessages.fields = fields

  /* pubrolemessages.associate = function (dbs) {
  } */

  return pubrolemessages
}
