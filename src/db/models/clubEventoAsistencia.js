import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_evento_asistencias', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    evento_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    registrado_por: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_evento_asistencias',
    timestamps: false,
  });
};
