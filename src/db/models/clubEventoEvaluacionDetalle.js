import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_evento_evaluacion_detalle', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    evaluacion_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    metrica_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    calificacion: {
      type: DataTypes.SMALLINT,
      allowNull: false,
    },
  }, {
    tableName: 'club_evento_evaluacion_detalle',
    timestamps: false,
  });
};
