import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('detailsCanchas', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    tipoSuperfice: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tipoDeCancha: {
      type: DataTypes.STRING,
      allowNull: true
    },
    capacidadMaxima: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    techado: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    iluminacion: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    dimensiones: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ubicacionInterna: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cancha_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'detailsCanchas',
    timestamps: false
  });
};
