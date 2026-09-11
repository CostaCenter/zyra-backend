import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_metrica_evaluacion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sport_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    nombre_metrica: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    categoria: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
  }, {
    tableName: 'club_metrica_evaluacion',
    timestamps: false,
  });
};
