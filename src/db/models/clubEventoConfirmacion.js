import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_evento_confirmaciones', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    evento_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    respuesta: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'SIN_RESPONDER',
    },
    respondido_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'club_evento_confirmaciones',
    timestamps: false,
  });
};
