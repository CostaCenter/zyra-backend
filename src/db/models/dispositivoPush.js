import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('dispositivos_push', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    push_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    plataforma: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
  }, {
    tableName: 'dispositivos_push',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });
};
