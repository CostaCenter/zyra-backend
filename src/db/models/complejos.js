import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('complejos', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ubicacion: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Jamundí, Cali, etc.'
    },
    dueño_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    photo: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    wallpaper: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'complejos',
    timestamps: false
  });
};
