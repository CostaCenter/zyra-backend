import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('partido_confirmaciones', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    partido_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'El capitán que firma'
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'El ID del equipo (para el descuento de puntos)'
    },
    rol_equipo: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '"LOCAL" o "VISITANTE"'
    },
    score_local_propuesto: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'El marcador que ese bando sostiene como real'
    },
    score_visitante_propuesto: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    es_impugnacion: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    creado_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'partido_confirmaciones',
    timestamps: false
  });
};
