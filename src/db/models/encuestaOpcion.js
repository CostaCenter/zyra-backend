import { DataTypes } from 'sequelize';

export default (sequelize) => sequelize.define('encuesta_opciones', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  encuesta_id: { type: DataTypes.INTEGER, allowNull: false },
  texto_opcion: { type: DataTypes.STRING(255), allowNull: false },
  orden: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'encuesta_opciones',
  timestamps: false,
});
