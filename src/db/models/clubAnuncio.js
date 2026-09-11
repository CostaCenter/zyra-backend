import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_anuncios', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    club_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    club_division_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    equipo_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    autor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    titulo: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    texto: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    importancia: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'NORMAL',
    },
    imagen_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imagen_width: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    imagen_height: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_anuncios',
    timestamps: false,
  });
};
