import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('reservas', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cancha_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Ej: 2026-05-18'
    },
    hora_inicio: {
      type: DataTypes.TIME,
      allowNull: false,
      comment: 'Ej: 19:00:00'
    },
    duracion_minutos: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
      comment: 'Bloques de 60, 90 o 120 min'
    },
    monto_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Precio calculado por el motor híbrido'
    },
    monto_abono: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      comment: '30% del total pagado para apartar'
    },
    metodo_pago: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'NEQUI, EFECTIVO, PAGOS_APP'
    },
    estado_pago: {
      type: DataTypes.STRING,
      defaultValue: 'ABONADA',
      comment: 'ABONADA, PAGADA_TOTAL, CANCELADA'
    },
    estado_reserva: {
      type: DataTypes.STRING,
      defaultValue: 'CONFIRMADA',
      comment: 'CONFIRMADA, FINALIZADA, NO_SHOW, CANCELADA'
    },

    // --- Campos de movimiento (solo dueño del complejo puede mover) ---
    fecha_original: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Fecha antes de ser movida por el dueño'
    },
    hora_inicio_original: {
      type: DataTypes.TIME,
      allowNull: true,
      comment: 'Hora antes de ser movida por el dueño'
    },
    motivo_movimiento: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Por qué el dueño movió la reserva'
    },
    movida_por_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'user_id del dueño que hizo el movimiento'
    },
    movida_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp de cuando se movió la reserva'
    },

    // --- Campos de cancelación ---
    cancelada_por_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'user_id de quien canceló (usuario o dueño)'
    },
    cancelada_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp de cancelación'
    },

    // --- Campos de origen y contacto ---
    origen_reserva: {
      type: DataTypes.STRING(20),
      defaultValue: 'WEB',
      comment: 'Origen: MANUAL, WEB, APP, API'
    },
    telefono_contacto: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Teléfono para reservas sin user_id'
    },
    nombre_contacto: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Nombre para reservas sin user_id'
    },

    creado_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'reservas',
    timestamps: false
  });
};
