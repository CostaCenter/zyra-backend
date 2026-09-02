import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('torneo_arbitros', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    torneo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado_confirmacion: {
      type: DataTypes.STRING(12),
      allowNull: false,
      defaultValue: 'PENDIENTE',
      validate: {
        isIn: [['PENDIENTE', 'CONFIRMADO', 'RECHAZADO']],
      },
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    actualizado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'torneo_arbitros',
    timestamps: false,
  });
};
