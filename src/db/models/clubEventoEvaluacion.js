import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_evento_evaluacion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    evento_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    evaluador_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    notas_generales: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_evento_evaluacion',
    timestamps: false,
  });
};
