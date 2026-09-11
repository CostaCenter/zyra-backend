import { DataTypes } from 'sequelize';

export default (sequelize) => sequelize.define('contenido_reacciones', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contenido_tipo: { type: DataTypes.STRING(20), allowNull: false },
  contenido_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo_reaccion: { type: DataTypes.STRING(20), allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'contenido_reacciones',
  timestamps: false,
});
