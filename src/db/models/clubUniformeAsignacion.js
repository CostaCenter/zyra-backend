import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_uniforme_asignaciones', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    club_division_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    prenda_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    talla: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    cantidad: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 1,
    },
    estado_actual: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'NUEVO',
    },
    fecha_entrega: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_uniforme_asignaciones',
    timestamps: false,
  });
};
