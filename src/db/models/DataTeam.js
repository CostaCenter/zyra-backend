import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('DataTeam', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    elo: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    games: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    win: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    lose: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    draw: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    total: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    fuerza_equipo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    }
  }, {
    tableName: 'DataTeam',
    timestamps: false
  });
};
