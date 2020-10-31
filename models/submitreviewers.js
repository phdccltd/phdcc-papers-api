module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    lead: { type: DataTypes.BOOLEAN, allowNull: false }
  }
  const submitreviewers = sequelize.define('submitreviewers', fields)
  submitreviewers.fields = fields

  submitreviewers.associate = function (dbs) {
    // Adds entries.submitId Sequelize.INTEGER allowNull:false
    dbs.submits.hasMany(dbs.submitreviewers, { as: 'Reviewers', foreignKey: { allowNull: false }, onDelete: 'RESTRICT' }) // Cannot delete submit while submitreviewers exist
    dbs.submitreviewers.belongsTo(dbs.submits, { foreignKey: { allowNull: false } })

    dbs.submitreviewers.belongsTo(dbs.users, { foreignKey: { allowNull: false } })

    dbs.submitreviewers.fields.userId = true
  }

  return submitreviewers
}
