import { DataTypes, Op } from 'sequelize';
import { PERMISOS_RECEPCIONISTA } from '../../constants/miembroPermisos.js';

export default (sequelize) => {
  return sequelize.define('usuario_complejo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'FK a user.id; null hasta que el invitado acepte o se registre'
    },
    complejo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'FK a complejos.id'
    },
    rol_en_complejo: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'ACCESO',
      comment: 'DUEÑO, ADMIN, ACCESO, EMPLEADO'
    },
    nombreInvitacion: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'nombre_invitacion',
      comment: 'Nombre del invitado al enviar la invitación'
    },
    correoInvitacion: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'correo_invitacion',
      comment: 'Correo al que se envía la invitación'
    },
    rolBase: {
      type: DataTypes.ENUM('ADMINISTRADOR', 'RECEPCIONISTA', 'PERSONALIZADO'),
      allowNull: false,
      defaultValue: 'RECEPCIONISTA',
      field: 'rol_base'
    },
    status: {
      type: DataTypes.ENUM('PENDIENTE', 'ACEPTADO', 'SUSPENDIDO'),
      allowNull: false,
      defaultValue: 'PENDIENTE'
    },
    permisos: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: PERMISOS_RECEPCIONISTA
    },
    creado_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'usuario_complejo',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'complejo_id'],
        where: {
          user_id: { [Op.ne]: null }
        }
      }
    ]
  });
};
