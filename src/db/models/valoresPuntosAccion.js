import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('valores_puntos_accion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sport_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tipo_accion: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    puntos_otorgados: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'valores_puntos_accion',
    timestamps: false,
  });
};
