const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const logs = sequelize.define('logs', {
    // id, createdAt and updatedAt: added automatically
    userid: { type: Sequelize.INTEGER, allowNull: true },
    level: { type: Sequelize.ENUM('info', 'warning', 'error') , allowNull: true },
    msg: { type: Sequelize.TEXT, allowNull: true }
  })

  //logs.associate = function (dbs) {}

  return logs
}
