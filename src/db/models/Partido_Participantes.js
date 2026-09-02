import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('Partido_Participantes', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    partido_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    es_local: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    color_uniforme: {
      type: DataTypes.STRING,
      allowNull: true
    },
    pago_completado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'Partido_Participantes',
    timestamps: false
  });
};
