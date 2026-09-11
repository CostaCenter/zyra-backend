import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_miembros', {
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
    rol_membresia: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    fecha_ingreso: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    estado: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
  }, {
    tableName: 'club_miembros',
    timestamps: false,
  });
};
