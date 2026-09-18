import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_uniforme_historial', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    asignacion_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado_anterior: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    estado_nuevo: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    fecha_cambio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    registrado_por_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    notas: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'club_uniforme_historial',
    timestamps: false,
  });
};
