const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const userconfs = sequelize.define('userconfs', {
    // id NOT created
    // createdAt and updatedAt: added automatically
    // These fields added using belongsToMany in index.js:
    //    userid: { type: Sequelize.INTEGER, allowNull: false },
    //    siteid: { type: Sequelize.INTEGER, allowNull: false },
  })

  userconfs.associate = function (models) {
    //models.User.hasMany(models.Task);
  }

  return userconfs
}
