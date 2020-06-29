// await conf.getUsers made available in index.js belongsToMany
// await conf.hasUser(req.user)

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const confs = sequelize.define('confs', {
    // id, createdAt and updatedAt: added automatically
    confid: { type: Sequelize.STRING(50), allowNull: false },
    name: { type: Sequelize.STRING(50), allowNull: false },
    title: { type: Sequelize.STRING, allowNull: false }
    // These fields added using belongsTo in index.js:
    //    siteid: { type: Sequelize.INTEGER, allowNull: false },
  })

  confs.associate = function (models) {}

  return confs
}
