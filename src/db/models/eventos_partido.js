import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('eventos_partido', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    partido_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    dispositivo_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    secuencia_local: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tipo_evento: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        isIn: [['PUNTO', 'CAMBIO', 'SANCION', 'ROTACION', 'ANULACION_EVENTO', 'CAMBIO_SET']]
      }
    },
    actor_principal_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    actor_secundario_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    detalle_json: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    ocurrido_en_cliente: {
      type: DataTypes.DATE,
      allowNull: false
    },
    recibido_en_servidor: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    creado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'eventos_partido',
    timestamps: false
  });
};
