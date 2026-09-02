import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('Team', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    logo_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ciudad_base: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    privado: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    creado_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    sport_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    capitan_id: {
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
    tableName: 'Team',
    timestamps: false
  });
};
