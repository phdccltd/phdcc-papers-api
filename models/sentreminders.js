const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    dt: { type: Sequelize.DATE, allowNull: false },
  }
  const sentreminders = sequelize.define('sentreminders', fields)
  sentreminders.fields = fields

  sentreminders.associate = function (dbs) {
    dbs.pubmailtemplates.hasMany(dbs.sentreminders, { as: 'SentReminders', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete pubmailtemplates while sentreminders exist
    dbs.sentreminders.belongsTo(dbs.pubmailtemplates, { foreignKey: { allowNull: false } })

    dbs.sentreminders.belongsTo(dbs.submits, { foreignKey: { allowNull: true } })

    dbs.sentreminders.belongsTo(dbs.users, { foreignKey: { allowNull: false } })
 }

  return sentreminders
}
