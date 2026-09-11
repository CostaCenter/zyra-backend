import { DataTypes } from 'sequelize';

export default (sequelize) => sequelize.define('contenido_comentarios', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contenido_tipo: { type: DataTypes.STRING(20), allowNull: false },
  contenido_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  texto: { type: DataTypes.TEXT, allowNull: false },
  comentario_padre_id: { type: DataTypes.INTEGER, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'contenido_comentarios',
  timestamps: false,
});
