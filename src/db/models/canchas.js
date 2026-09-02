import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('canchas', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    complejo_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '"Cancha 1", "Sintética Pro"'
    },
    tipo_deporte: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '"Voley", "Fútbol"'
    },
    sport_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    precio_hora: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'DISPONIBLE, OCUPADA, MANTENIMIENTO, FUERA DE SERVICIO'
    },
    photo: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'canchas',
    timestamps: false
  });
};
