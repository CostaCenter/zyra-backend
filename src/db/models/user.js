import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('user', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    nick: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    photo: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    foto_portada_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Portada/acción del perfil público'
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deporte_principal_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Deporte destacado en perfil público'
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'Para Google Auth y Login tradicional'
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'Para Login por teléfono'
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Solo se llena si no usa Google'
    },
    google_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: 'El ID que te da Google (sub)'
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'JUGADOR, DUEÑO, ADMIN'
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'ACTIVO',
      comment: 'ACTIVO, BANEADO, POR_VERIFICAR'
    },
    creado_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    es_dato_prueba: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Marcador local — datos seed, no producción'
    }
  }, {
    tableName: 'user',
    timestamps: false
  });
};
