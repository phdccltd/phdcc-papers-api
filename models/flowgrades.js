const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    name: { type: Sequelize.STRING(100), allowNull: false },
    flowstatusId: { type: Sequelize.INTEGER, allowNull: false },        // Show if at this status
    displayflowstageId: { type: Sequelize.INTEGER, allowNull: false },  // Displays this stage
    visibletorole: { type: Sequelize.INTEGER, allowNull: false },
    visibletoreviewers: { type: DataTypes.BOOLEAN, allowNull: false },
    cancomment: { type: DataTypes.BOOLEAN, allowNull: false },
    canopttoreview: { type: DataTypes.BOOLEAN, allowNull: false },
    authorcanseeatthisstatus: { type: Sequelize.INTEGER, allowNull: false },  // Author can see comments if at this status
    helptext: { type: Sequelize.STRING, allowNull: false },
    helplinktext: { type: Sequelize.STRING, allowNull: false },
    helplink: { type: Sequelize.STRING, allowNull: false },
  }
  const flowgrades = sequelize.define('flowgrades', fields)
  flowgrades.fields = fields

  flowgrades.associate = function (dbs) {
    // Adds flowgrades.flowId Sequelize.INTEGER allowNull:false
    dbs.flows.hasMany(dbs.flowgrades, { foreignKey: { allowNull: false }, onDelete: 'RESTRICT' })  // Cannot delete flow while flowgrades exist
    dbs.flowgrades.belongsTo(dbs.flows, { foreignKey: { allowNull: false }})
 }

  return flowgrades
}
