import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('club_divisiones', {
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
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    genero: {
      type: DataTypes.STRING(16),
      allowNull: true,
      validate: {
        generoValido(value) {
          if (value != null && !['MASCULINO', 'FEMENINO', 'MIXTO'].includes(value)) {
            throw new Error('Género inválido');
          }
        },
      },
    },
    categoria_edad: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    encargado_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'club_divisiones',
    timestamps: false,
  });
};
