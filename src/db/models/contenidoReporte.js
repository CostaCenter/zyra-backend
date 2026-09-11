import { DataTypes } from 'sequelize';

export default (sequelize) => sequelize.define('contenido_reportes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contenido_tipo: { type: DataTypes.STRING(20), allowNull: false },
  contenido_id: { type: DataTypes.INTEGER, allowNull: false },
  reportado_por_id: { type: DataTypes.INTEGER, allowNull: false },
  motivo: { type: DataTypes.TEXT, allowNull: false },
  estado: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'PENDIENTE',
  },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'contenido_reportes',
  timestamps: false,
});
