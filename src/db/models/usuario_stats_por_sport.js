import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('usuario_stats_por_sport', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    sport_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    elo_oficial: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1.0,
      comment: 'STATS OFICIALES (Torneos/Ligas)'
    },
    goles_oficiales: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    partidos_oficiales: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    elo_casual: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1.0,
      comment: 'STATS CASUALES (Retos/Amistosos)'
    },
    goles_casuales: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    partidos_casuales: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    posicion_principal: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '"PORTERO", "DEFENSA", "DELANTERO", "LÍBERO" - ARMADOR, CENTRAL, PUNTA, OPUESTO'
    },
    pierna_habil: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '"DERECHA", "IZQUIERDA", "AMBIDIESTRO"'
    },
    mano_habil: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '"DERECHA", "IZQUIERDA", "AMBIDIESTRO" — vóley'
    },
    dorsal_preferido: {
      type: DataTypes.SMALLINT,
      allowNull: true
    }
  }, {
    tableName: 'usuario_stats_por_sport',
    timestamps: false
  });
};
