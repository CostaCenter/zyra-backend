import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('sports', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Futbol, voley'
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Disponible'
    }
  }, {
    tableName: 'sports',
    timestamps: false
  });
};
