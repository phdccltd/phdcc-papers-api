// await user.getConferences made available in index.js belongsToMany
// await user.hasConference(conf)

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const users = sequelize.define(
    'users',
    {
      // id, createdAt and updatedAt: added automatically
      name: { type: Sequelize.STRING, allowNull: false, defaultValue: '' },
      username: { type: Sequelize.STRING(50), allowNull: false },
      password: { type: Sequelize.STRING, allowNull: false },
      lastlogin: { type: Sequelize.DATE, allowNull: true },
      super: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      getterMethods: {
        lastlogins() {
          const lastlogin = this.getDataValue('lastlogin') // Date object
          if (!lastlogin) return ''
          return lastlogin.toISOString().substring(0, 16) // YYYY-MM-DDTHH:mm:ss.sssZ -> yyyy-MM-ddThh:mm
        },
      },
    }
  )

  users.associate = function (models) {}

  return users
}
