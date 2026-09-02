import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('complejo_horarios', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    complejo_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    dia_semana: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '0 = Domingo, 1 = Lunes, etc.'
    },
    hora_apertura: {
      type: DataTypes.TIME,
      allowNull: true
    },
    hora_cierre: {
      type: DataTypes.TIME,
      allowNull: true
    },
    esta_cerrado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Para festivos o mantenimientos'
    }
  }, {
    tableName: 'complejo_horarios',
    timestamps: false
  });
};
