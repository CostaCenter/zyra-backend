import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('Team_Miembros', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    position: {
      type: DataTypes.STRING,
      allowNull: true
    },
    rol: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '"CAPITAN", "SUB_CAPITAN", "JUGADOR"'
    },
    estado_invitacion: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '"PENDIENTE", "ACEPTADO", "RECHAZADO"'
    },
    fecha_union: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    dorsal_habitual: {
      type: DataTypes.SMALLINT,
      allowNull: true
    }
  }, {
    tableName: 'Team_Miembros',
    timestamps: false
  });
};
