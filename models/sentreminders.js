const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    dt: { type: Sequelize.DATE, allowNull: false },
  }
  const sentreminders = sequelize.define('sentreminders', fields)
  sentreminders.fields = fields

  sentreminders.associate = function (dbs) {
    dbs.flowmailrules.hasMany(dbs.sentreminders, { as: 'SentReminders', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flowmailrules while sentreminders exist
    dbs.sentreminders.belongsTo(dbs.flowmailrules, { foreignKey: { allowNull: false } })

    dbs.sentreminders.belongsTo(dbs.users, { foreignKey: { allowNull: false } })
 }

  return sentreminders
}
