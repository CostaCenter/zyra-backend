import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_eventos', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    club_division_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    titulo: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    lugar: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    recurrente: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    fecha_hora_fin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    dias_recurrencia: {
      type: DataTypes.ARRAY(DataTypes.SMALLINT),
      allowNull: true,
    },
    enfoque_sesion: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    metricas_a_evaluar: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    cupo_limite: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    indumentaria_sugerida: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    partido_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    evento_serie_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    completado_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    asistencia_real_pct: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    creado_por_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_eventos',
    timestamps: false,
  });
};
