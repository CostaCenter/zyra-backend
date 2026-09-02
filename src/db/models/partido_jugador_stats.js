import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('partido_jugador_stats', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    partido_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    goles: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    asistencias: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    amarillas: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    rojas: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    puntos_personales: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    jugo_minutos: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
      comment: 'Opcional'
    }
  }, {
    tableName: 'partido_jugador_stats',
    timestamps: false
  });
};
