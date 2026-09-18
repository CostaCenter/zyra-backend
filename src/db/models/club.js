import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('clubs', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    logo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ubicacion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sport_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    admin_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    whatsapp_plantilla_pago: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Plantilla WhatsApp recordatorio pagos. Placeholders: {nombre},{club},{concepto},{monto},{fecha_corte}',
    },
  }, {
    tableName: 'clubs',
    timestamps: false,
  });
};
