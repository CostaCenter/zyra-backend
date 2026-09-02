import { Op } from 'sequelize';
import { User, Complejos, UsuarioComplejo } from '../db/db.js';
import { checkAccess, hasRole } from './complejoAccessService.js';
import { PERMISOS_DEFECTO } from '../constants/miembroPermisos.js';

const ROLES_GESTION_MIEMBROS = ['DUEÑO', 'ADMIN'];
const ESTADOS_ACTIVOS = ['PENDIENTE', 'ACEPTADO'];

const normalizarCorreo = (correo) => correo.trim().toLowerCase();

const esObjetoPermisosValido = (permisos) =>
  permisos != null && typeof permisos === 'object' && !Array.isArray(permisos);

export const tieneAccesoComplejo = async (userId, complejoId) => {
  const complejo = await Complejos.findByPk(complejoId, {
    attributes: ['id', 'dueño_id']
  });

  if (!complejo) {
    return false;
  }

  if (complejo.dueño_id === userId) {
    return true;
  }

  const access = await checkAccess(userId, complejoId);
  return Boolean(access);
};

export const puedeGestionarMiembros = async (userId, complejoId) => {
  const complejo = await Complejos.findByPk(complejoId, {
    attributes: ['id', 'dueño_id']
  });

  if (!complejo) {
    return false;
  }

  if (complejo.dueño_id === userId) {
    return true;
  }

  return hasRole(userId, complejoId, ROLES_GESTION_MIEMBROS);
};

const mapearRolEnComplejo = (rolBase) =>
  rolBase === 'ADMINISTRADOR' ? 'ADMIN' : 'EMPLEADO';

export const invitarMiembro = async ({
  complejoId,
  nombre,
  correo,
  rolBase,
  permisos,
  invitadoPorUserId
}) => {
  const correoNormalizado = normalizarCorreo(correo);

  if (!nombre?.trim()) {
    throw new Error('El nombre es requerido');
  }

  if (!correoNormalizado) {
    throw new Error('El correo es requerido');
  }

  const rolesValidos = ['ADMINISTRADOR', 'RECEPCIONISTA', 'PERSONALIZADO'];
  if (!rolesValidos.includes(rolBase)) {
    throw new Error('rolBase inválido');
  }

  if (!esObjetoPermisosValido(permisos)) {
    throw new Error('permisos debe ser un objeto JSON válido');
  }

  const complejo = await Complejos.findByPk(complejoId);
  if (!complejo) {
    throw new Error('Complejo no encontrado');
  }

  const puedeInvitar = await puedeGestionarMiembros(invitadoPorUserId, complejoId);
  if (!puedeInvitar) {
    const error = new Error('No tienes permisos para invitar miembros en este complejo');
    error.statusCode = 403;
    throw error;
  }

  const invitacionExistente = await UsuarioComplejo.findOne({
    where: {
      complejo_id: complejoId,
      correoInvitacion: { [Op.iLike]: correoNormalizado },
      status: { [Op.in]: ESTADOS_ACTIVOS }
    }
  });

  if (invitacionExistente) {
    const error = new Error('Ya existe una invitación activa para este correo en el complejo');
    error.statusCode = 409;
    throw error;
  }

  const usuarioGlobal = await User.findOne({
    where: {
      email: { [Op.iLike]: correoNormalizado }
    }
  });

  if (usuarioGlobal) {
    const accesoExistente = await UsuarioComplejo.findOne({
      where: {
        user_id: usuarioGlobal.id,
        complejo_id: complejoId,
        status: { [Op.in]: ESTADOS_ACTIVOS }
      }
    });

    if (accesoExistente) {
      const error = new Error('Este usuario ya tiene acceso activo al complejo');
      error.statusCode = 409;
      throw error;
    }
  }

  const registro = await UsuarioComplejo.create({
    user_id: usuarioGlobal?.id ?? null,
    complejo_id: complejoId,
    nombreInvitacion: nombre.trim(),
    correoInvitacion: correoNormalizado,
    rolBase,
    status: 'PENDIENTE',
    permisos: permisos ?? PERMISOS_DEFECTO,
    rol_en_complejo: mapearRolEnComplejo(rolBase),
  });

  return registro;
};

export const listarMiembros = async (complejoId, requesterUserId) => {
  const complejo = await Complejos.findByPk(complejoId);
  if (!complejo) {
    throw new Error('Complejo no encontrado');
  }

  const tieneAcceso = await tieneAccesoComplejo(requesterUserId, complejoId);
  if (!tieneAcceso) {
    const error = new Error('No tienes acceso a este complejo');
    error.statusCode = 403;
    throw error;
  }

  return UsuarioComplejo.findAll({
    where: { complejo_id: complejoId },
    include: [
      {
        model: User,
        as: 'usuario',
        attributes: ['id', 'name', 'email', 'photo'],
        required: false
      }
    ],
    order: [['creado_at', 'DESC']]
  });
};

export const actualizarMiembro = async ({
  miembroId,
  requesterUserId,
  nombre,
  correo,
  rolBase,
  permisos
}) => {
  const registro = await UsuarioComplejo.findByPk(miembroId);

  if (!registro) {
    const error = new Error('Miembro no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (registro.rol_en_complejo === 'DUEÑO') {
    const error = new Error('No se puede editar al dueño del complejo');
    error.statusCode = 403;
    throw error;
  }

  const puedeEditar = await puedeGestionarMiembros(requesterUserId, registro.complejo_id);
  if (!puedeEditar) {
    const error = new Error('No tienes permisos para editar miembros en este complejo');
    error.statusCode = 403;
    throw error;
  }

  const datosActualizar = {};

  if (nombre !== undefined) {
    if (!nombre?.trim()) {
      throw new Error('El nombre es requerido');
    }
    datosActualizar.nombreInvitacion = nombre.trim();
  }

  if (correo !== undefined) {
    const correoNormalizado = normalizarCorreo(correo);
    if (!correoNormalizado) {
      throw new Error('El correo es requerido');
    }

    const correoActual = registro.correoInvitacion?.toLowerCase() ?? '';
    if (correoNormalizado !== correoActual) {
      const duplicado = await UsuarioComplejo.findOne({
        where: {
          complejo_id: registro.complejo_id,
          correoInvitacion: { [Op.iLike]: correoNormalizado },
          status: { [Op.in]: ESTADOS_ACTIVOS },
          id: { [Op.ne]: miembroId }
        }
      });

      if (duplicado) {
        const error = new Error('Ya existe una invitación activa para este correo en el complejo');
        error.statusCode = 409;
        throw error;
      }
    }

    datosActualizar.correoInvitacion = correoNormalizado;
  }

  if (rolBase !== undefined) {
    const rolesValidos = ['ADMINISTRADOR', 'RECEPCIONISTA', 'PERSONALIZADO'];
    if (!rolesValidos.includes(rolBase)) {
      throw new Error('rolBase inválido');
    }
    datosActualizar.rolBase = rolBase;
    datosActualizar.rol_en_complejo = mapearRolEnComplejo(rolBase);
  }

  if (permisos !== undefined) {
    if (!esObjetoPermisosValido(permisos)) {
      throw new Error('permisos debe ser un objeto JSON válido');
    }
    datosActualizar.permisos = permisos;
  }

  if (Object.keys(datosActualizar).length === 0) {
    throw new Error('No se proporcionaron campos para actualizar');
  }

  if (registro.user_id && (datosActualizar.nombreInvitacion || datosActualizar.correoInvitacion)) {
    const userUpdate = {};

    if (datosActualizar.nombreInvitacion) {
      userUpdate.name = datosActualizar.nombreInvitacion;
    }

    if (datosActualizar.correoInvitacion) {
      const emailEnUso = await User.findOne({
        where: {
          email: { [Op.iLike]: datosActualizar.correoInvitacion },
          id: { [Op.ne]: registro.user_id }
        }
      });

      if (emailEnUso) {
        const error = new Error('El correo ya está registrado por otro usuario');
        error.statusCode = 409;
        throw error;
      }

      userUpdate.email = datosActualizar.correoInvitacion;
    }

    await User.update(userUpdate, { where: { id: registro.user_id } });
  }

  await registro.update(datosActualizar);

  return UsuarioComplejo.findByPk(miembroId, {
    include: [
      {
        model: User,
        as: 'usuario',
        attributes: ['id', 'name', 'email', 'photo'],
        required: false
      }
    ]
  });
};
