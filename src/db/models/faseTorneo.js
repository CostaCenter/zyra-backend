import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('fases_torneo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    torneo_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    orden: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo_formato: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        isIn: [['TODOS_CONTRA_TODOS', 'ELIMINACION_DIRECTA', 'GRUPOS_ELIMINATORIAS']]
      }
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    tableName: 'fases_torneo',
    timestamps: false
  });
};
