import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('torneo_inscripciones', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    torneo_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    origen: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['SOLICITUD_EQUIPO', 'INVITACION_TORNEO']]
      }
    },
    iniciado_por_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    estado: {
      type: DataTypes.STRING(15),
      allowNull: false,
      defaultValue: 'PENDIENTE',
      validate: {
        isIn: [['PENDIENTE', 'ACEPTADA', 'RECHAZADA']]
      }
    },
    resuelto_por_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    resuelto_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'torneo_inscripciones',
    timestamps: false
  });
};
