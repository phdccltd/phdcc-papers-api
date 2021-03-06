//  Created in userpubs.js:
//      pub.getUsers
//      pub.hasUser(req.user)
//      user.getPublications

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = { // Don't include password here - so it doesn't appear in sanitised version
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING, allowNull: false, defaultValue: '' },
    username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
    email: { type: Sequelize.STRING, allowNull: false },
    lastlogin: { type: Sequelize.DATE, allowNull: true },
    super: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    deleted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    resettoken: { type: Sequelize.STRING, allowNull: true },
    resetexpires: { type: Sequelize.DATE, allowNull: true }
  }
  const users = sequelize.define('users', {
    password: { type: Sequelize.STRING, allowNull: false },
    actas: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    ...fields
  }
  /*,
  {
    getterMethods: {
      lastlogins () {
        const lastlogin = this.getDataValue('lastlogin') // Date object
        if (!lastlogin) return ''
        return lastlogin.toISOString().substring(0, 16) // YYYY-MM-DDTHH:mm:ss.sssZ -> yyyy-MM-ddThh:mm
      }
    }
  } */
  )
  users.fields = fields

  // users.associate = function (dbs) {}

  return users
}
