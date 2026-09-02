import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('torneo_plantilla', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    torneo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dorsal_torneo: {
      type: DataTypes.SMALLINT,
      allowNull: true,
    },
    posicion_torneo: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    mano_habil_torneo: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    es_libero: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    actualizado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'torneo_plantilla',
    timestamps: false,
  });
};
