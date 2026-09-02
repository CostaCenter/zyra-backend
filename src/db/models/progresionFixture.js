import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('progresion_fixture', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    torneo_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    partido_origen_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    partido_destino_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    condicion_avance: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['GANADOR', 'PERDEDOR']]
      }
    },
    posicion_destino: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['LOCAL', 'VISITANTE']]
      }
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'progresion_fixture',
    timestamps: false
  });
};
