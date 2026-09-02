import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('configuracion_horarios_favoritos', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    complejo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'complejos',
        key: 'id'
      }
    },
    cancha_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'canchas',
        key: 'id'
      },
      comment: 'Cancha a la que pertenece esta configuración favorita'
    },
    nombre_plantilla: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Nombre descriptivo de la plantilla, ej: "Precios Verano", "Horario Especial Navidad"'
    },
    configuracion: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'JSON estructurado con bloques de horarios y precios {bloques: [{dias, horaInicio, horaFin, precio}]}'
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'configuracion_horarios_favoritos',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
};
