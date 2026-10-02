import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('user_activity_events', {
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
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    entidad_tipo: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    entidad_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    occurred_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'user_activity_events',
    timestamps: false,
  });
};
