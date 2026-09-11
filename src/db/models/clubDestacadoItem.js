import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_destacado_items', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    destacado_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    duracion_segundos: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 5,
    },
    orden: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_destacado_items',
    timestamps: false,
  });
};
