import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_division_invitaciones', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    club_division_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuario_invitado_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    invitado_por_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'PENDIENTE',
      validate: {
        isIn: [['PENDIENTE', 'ACEPTADA', 'RECHAZADA']],
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_division_invitaciones',
    timestamps: false,
  });
};
