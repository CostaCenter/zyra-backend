import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('calendario_excepciones', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    complejo_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      unique: true,
      comment: 'Ej: 2026-05-18 (Lunes festivo)'
    },
    esta_abierto: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    es_festivo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Si es true, el sistema busca "tipo_dia: 7"'
    },
    descripcion: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Ej: "Lunes de Ascensión"'
    }
  }, {
    tableName: 'calendario_excepciones',
    timestamps: false
  });
};
