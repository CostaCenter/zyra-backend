import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_conceptos_pago', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    club_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    nombre_personalizado: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    monto: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    dias_aviso_previo: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 5,
    },
    dias_gracia: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 0,
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
    tableName: 'club_conceptos_pago',
    timestamps: false,
  });
};
