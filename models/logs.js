const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    userid: { type: Sequelize.INTEGER, allowNull: true },
    level: { type: Sequelize.ENUM('info', 'warning', 'error') , allowNull: true },
    msg: { type: Sequelize.TEXT, allowNull: true }
  }
  const logs = sequelize.define('logs', fields)
  logs.fields = fields

  //logs.associate = function (dbs) {}

  return logs
}
