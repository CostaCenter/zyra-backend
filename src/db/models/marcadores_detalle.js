import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('marcadores_detalle', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    partido_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    resultado_principal: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    sets_ganados_local: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 0
    },
    sets_ganados_visitante: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 0
    },
    puntos_favor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    puntos_contra: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    metrica_estructura: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    ultimo_evento_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    reglas_arbitraje_snapshot: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    posiciones_actuales: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { equipo_local: null, equipo_visitante: null }
    },
    equipo_que_saca: {
      type: DataTypes.STRING(12),
      allowNull: true
    },
    actualizado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'marcadores_detalle',
    timestamps: false
  });
};
