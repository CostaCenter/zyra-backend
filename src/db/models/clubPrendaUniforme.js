import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_prendas_uniforme', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    club_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    nombre: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    sistema_talla: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_prendas_uniforme',
    timestamps: false,
  });
};
