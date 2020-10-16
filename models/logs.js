const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    ip: { type: Sequelize.STRING, allowNull: true },
    userid: { type: Sequelize.INTEGER, allowNull: true },
    actid: { type: Sequelize.INTEGER, allowNull: true },
    level: { type: Sequelize.ENUM('info', 'warning', 'error') , allowNull: true },
    url: { type: Sequelize.STRING, allowNull: true },
    msg: { type: Sequelize.TEXT, allowNull: true }
  }
  const logs = sequelize.define('logs', fields)
  logs.fields = fields

  //logs.associate = function (dbs) {}

  return logs
}
