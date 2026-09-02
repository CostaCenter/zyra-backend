import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('grupos_divisiones', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fase_torneo_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false
    }
  }, {
    tableName: 'grupos_divisiones',
    timestamps: false
  });
};
