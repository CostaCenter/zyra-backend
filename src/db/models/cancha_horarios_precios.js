import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('cancha_horarios_precios', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    cancha_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    tipo_dia: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '0=Dom, 1=Lun, ..., 6=Sab, 7=FESTIVO (El Híbrido)'
    },
    hora_inicio: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Ej: 08:00'
    },
    hora_fin: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Ej: 14:00'
    },
    precio_hora: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Ej: 60000'
    }
  }, {
    tableName: 'cancha_horarios_precios',
    timestamps: false
  });
};
