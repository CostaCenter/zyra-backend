import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_membresia_solicitudes', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    club_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado: {
      type: DataTypes.STRING(15),
      allowNull: false,
      defaultValue: 'PENDIENTE',
      validate: {
        isIn: [['PENDIENTE', 'ACEPTADA', 'RECHAZADA']],
      },
    },
    origen: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'CODIGO',
    },
    resuelto_por_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rol_asignado: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    resuelto_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_membresia_solicitudes',
    timestamps: false,
  });
};
