import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('grupo_equipos', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    grupo_division_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'grupo_equipos',
    timestamps: false
  });
};
