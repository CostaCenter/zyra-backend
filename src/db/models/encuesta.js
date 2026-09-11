import { DataTypes } from 'sequelize';

export default (sequelize) => sequelize.define('encuestas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contenido_tipo: { type: DataTypes.STRING(20), allowNull: false },
  contenido_id: { type: DataTypes.INTEGER, allowNull: false },
  pregunta: { type: DataTypes.STRING(500), allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'encuestas',
  timestamps: false,
});
