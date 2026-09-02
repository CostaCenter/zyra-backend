import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('publicacion_etiquetas', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    publicacion_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id_etiquetado: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    confirmado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    tableName: 'publicacion_etiquetas',
    timestamps: false
  });
};
