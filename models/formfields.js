//  Created after all models made

const Sequelize = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const fields = {
    // id, createdAt and updatedAt: added automatically
    formtype: { type: Sequelize.INTEGER, allowNull: false },  // NOT USED, but formtype==2 for form for stage
    formtypeid: { type: Sequelize.INTEGER, allowNull: false },  // flowstageId
    label: { type: Sequelize.STRING, allowNull: false },
    help: { type: Sequelize.STRING, allowNull: false },
    helplink: { type: Sequelize.STRING, allowNull: false },
    weight: { type: Sequelize.INTEGER, allowNull: false },
    type: { type: Sequelize.STRING, allowNull: false },
    required: { type: DataTypes.BOOLEAN, allowNull: false },
    requiredif: { type: Sequelize.STRING, allowNull: false },
    allowedfiletypes: { type: Sequelize.STRING, allowNull: true },
    maxwords: { type: Sequelize.INTEGER, allowNull: true },
    maxchars: { type: Sequelize.INTEGER, allowNull: true },
    hideatgrading: { type: DataTypes.INTEGER, allowNull: false },
    includeindownload: { type: DataTypes.INTEGER, allowNull: false }
  }
  const formfields = sequelize.define('formfields', fields)
  formfields.fields = fields

  formfields.associate = function (dbs) {
    // Adds formfields.publookupid Sequelize.INTEGER allowNull:true
    dbs.publookups.hasMany(dbs.formfields, { foreignKey: { allowNull: true }, onDelete: 'RESTRICT' }) // Cannot delete pub while publookups exist
    dbs.formfields.belongsTo(dbs.publookups, { foreignKey: { allowNull: true } })

    dbs.formfields.belongsTo(dbs.pubroles, { foreignKey: { allowNull: true } })

    dbs.formfields.fields.publookupId = true
    dbs.formfields.fields.pubroleId = true
  }

  return formfields
}
