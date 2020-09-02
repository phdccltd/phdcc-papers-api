const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id NOT created
    // createdAt and updatedAt: added automatically
  }
  const pubuserroles = sequelize.define('pubuserroles', fields)
  pubuserroles.fields = fields

  pubuserroles.associate = function (dbs) {
    // Adds userpubs.userid: Sequelize.INTEGER allowNull:false
    // Adds userpubs.siteid: Sequelize.INTEGER allowNull:false
    dbs.users.belongsToMany(dbs.pubroles, {
      as: 'Roles',
      through: dbs.pubuserroles,
      foreignKey: 'userid'
    }) // becomes user.getRoles
    dbs.pubroles.belongsToMany(dbs.users, {
      as: 'Users',
      through: dbs.pubuserroles,
      foreignKey: 'pubroleid'
    }) // becomes pubrole.getUsers
 }

  return pubuserroles
}
