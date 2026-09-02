import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('publicacion_deportes', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    publicacion_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sport_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'publicacion_deportes',
    timestamps: false
  });
};
