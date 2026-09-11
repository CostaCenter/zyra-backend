import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_solicitudes', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    club_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    equipo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    club_division_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING(15),
      allowNull: false,
      defaultValue: 'PENDIENTE',
      validate: {
        isIn: [['PENDIENTE', 'ACEPTADA', 'RECHAZADA']],
      },
    },
    iniciado_por_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    resuelto_por_id: {
      type: DataTypes.INTEGER,
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
    tableName: 'club_solicitudes',
    timestamps: false,
  });
};
