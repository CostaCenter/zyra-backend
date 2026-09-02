import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('publicaciones', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['FOTO', 'VIDEO']]
      }
    },
    url_media: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    caption: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    media_width: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    media_height: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    creado_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    es_dato_prueba: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Marcador local — datos seed, no producción'
    }
  }, {
    tableName: 'publicaciones',
    timestamps: false
  });
};
