import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_pagos_miembro', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    concepto_pago_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fecha_corte: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_pago_real: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'PENDIENTE',
    },
    registrado_por_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    aviso_enviado_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_pagos_miembro',
    timestamps: false,
  });
};
