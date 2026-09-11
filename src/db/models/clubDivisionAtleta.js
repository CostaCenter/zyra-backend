import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_division_atletas', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    club_division_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dorsal: {
      type: DataTypes.SMALLINT,
      allowNull: true,
    },
    posicion: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'ACTIVO',
      validate: {
        isIn: [['ACTIVO', 'LESIONADO', 'INACTIVO']],
      },
    },
    fecha_ingreso: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_division_atletas',
    timestamps: false,
  });
};
