import { DataTypes } from 'sequelize';

export default (sequelize) => {
  return sequelize.define('partido_nominas', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    partido_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    team_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    dorsal: {
      type: DataTypes.SMALLINT,
      allowNull: false
    },
    rol_nomina: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['TITULAR', 'SUPLENTE']]
      }
    },
    propuesto_por_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Capitán que propone la nómina'
    },
    validado_por_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Árbitro que valida la nómina'
    },
    estado_validacion: {
      type: DataTypes.STRING(15),
      allowNull: false,
      defaultValue: 'PENDIENTE',
      validate: {
        isIn: [['PENDIENTE', 'VALIDADO', 'RECHAZADO']]
      }
    },
    validado_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    zona: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      comment: 'Zona en cancha 1-6 (titulares)'
    },
    set_numero: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 1,
      comment: 'Set al que aplica esta nómina/alineación (1-based)'
    },
    creado_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'partido_nominas',
    timestamps: false
  });
};
