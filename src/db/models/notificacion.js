import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('notificaciones', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    categoria: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    referencia_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    referencia_tipo: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    leida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    tableName: 'notificaciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
};
