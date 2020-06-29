const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const logs = sequelize.define('logs', {
    // id, createdAt and updatedAt: added automatically
    userid: { type: Sequelize.INTEGER, allowNull: true },
    msg: { type: Sequelize.TEXT, allowNull: true }
  })

  logs.associate = function (models) {}

  return logs
}
