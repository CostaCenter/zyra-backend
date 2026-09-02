import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('seguidores', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    seguidor_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    seguido_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    seguido_team_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    es_dato_prueba: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Marcador local — datos seed, no producción'
    }
  }, {
    tableName: 'seguidores',
    timestamps: false
  });
};
