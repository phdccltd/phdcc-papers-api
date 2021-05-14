// Note: NOT cleared if a User, Publication, etc is deleted
// Question: could values (eg submitId) be reused if last one deleted
const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    dt: { type: Sequelize.DATE, allowNull: false },
    action: { type: Sequelize.ENUM('add', 'update', 'delete'), allowNull: true },
    byUserId: { type: DataTypes.INTEGER, allowNull: true },
    onUserId: { type: DataTypes.INTEGER, allowNull: true },
    submitId: { type: DataTypes.INTEGER, allowNull: true },
    entryId: { type: DataTypes.INTEGER, allowNull: true },
    stageId: { type: DataTypes.INTEGER, allowNull: true },
    statusId: { type: DataTypes.INTEGER, allowNull: true },
    gradingId: { type: DataTypes.INTEGER, allowNull: true },
    sentPubMailTemplateId: { type: DataTypes.INTEGER, allowNull: true },
    sentReminderPubMailTemplateId: { type: DataTypes.INTEGER, allowNull: true }
  }
  const actionlogs = sequelize.define('actionlogs', fields, {
    indexes: [
      {
        name: 'onuser_submit_sentreminder',
        fields: ['onUserId', 'submitId', 'sentReminderPubMailTemplateId']
      }
    ]
  })
  actionlogs.fields = fields

  // actionlogs.associate = function (dbs) {
  // }

  return actionlogs
}
