import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('WallpaperCanchas', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    img_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    state: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    cancha_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'WallpaperCanchas',
    timestamps: false
  });
};
