import { DataTypes } from 'sequelize';

export default (sequelize) => sequelize.define('encuesta_votos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  encuesta_id: { type: DataTypes.INTEGER, allowNull: false },
  encuesta_opcion_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'encuesta_votos',
  timestamps: false,
});
