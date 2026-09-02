import { User, Complejos, UsuarioComplejo } from '../db/db.js';

/**
 * Servicio para gestionar accesos de usuarios a complejos
 */

/**
 * Otorgar acceso a un usuario a un complejo
 * @param {number} userId - ID del usuario
 * @param {number} complejoId - ID del complejo
 * @param {string} rol - Rol del usuario en el complejo (DUEÑO, ADMIN, ACCESO, EMPLEADO)
 * @returns {Promise<Object>} Registro de acceso creado
 */
export const grantAccess = async (userId, complejoId, rol = 'ACCESO') => {
  // Validar que el usuario existe
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  // Validar que el complejo existe
  const complejo = await Complejos.findByPk(complejoId);
  if (!complejo) {
    throw new Error('Complejo no encontrado');
  }

  // Crear o actualizar el acceso
  const [access, created] = await UsuarioComplejo.findOrCreate({
    where: {
      user_id: userId,
      complejo_id: complejoId
    },
    defaults: {
      rol_en_complejo: rol
    }
  });

  // Si ya existía, actualizar el rol
  if (!created && access.rol_en_complejo !== rol) {
    await access.update({ rol_en_complejo: rol });
  }

  return access;
};

/**
 * Revocar acceso de un usuario a un complejo
 * @param {number} userId - ID del usuario
 * @param {number} complejoId - ID del complejo
 * @returns {Promise<boolean>} true si se eliminó, false si no existía
 */
export const revokeAccess = async (userId, complejoId) => {
  const deleted = await UsuarioComplejo.destroy({
    where: {
      user_id: userId,
      complejo_id: complejoId
    }
  });

  return deleted > 0;
};

/**
 * Obtener todos los usuarios con acceso a un complejo
 * @param {number} complejoId - ID del complejo
 * @returns {Promise<Array>} Lista de usuarios con acceso
 */
export const getUsersWithAccess = async (complejoId) => {
  const complejo = await Complejos.findByPk(complejoId, {
    include: [
      {
        model: User,
        as: 'usuariosConAcceso',
        through: {
          attributes: ['rol_en_complejo', 'creado_at']
        },
        attributes: ['id', 'name', 'nick', 'email', 'telefono', 'photo', 'role']
      }
    ]
  });

  if (!complejo) {
    throw new Error('Complejo no encontrado');
  }

  return complejo.usuariosConAcceso || [];
};

/**
 * Obtener todos los complejos a los que un usuario tiene acceso
 * @param {number} userId - ID del usuario
 * @returns {Promise<Array>} Lista de complejos con acceso
 */
export const getUserComplexes = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: Complejos,
        as: 'complejosConAcceso',
        through: {
          attributes: ['rol_en_complejo', 'creado_at']
        },
        attributes: ['id', 'nombre', 'ubicacion', 'photo', 'wallpaper']
      }
    ]
  });

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  return user.complejosConAcceso || [];
};

/**
 * Verificar si un usuario tiene acceso a un complejo
 * @param {number} userId - ID del usuario
 * @param {number} complejoId - ID del complejo
 * @returns {Promise<Object|null>} Registro de acceso si existe, null si no
 */
export const checkAccess = async (userId, complejoId) => {
  const access = await UsuarioComplejo.findOne({
    where: {
      user_id: userId,
      complejo_id: complejoId
    }
  });

  return access;
};

/**
 * Verificar si un usuario tiene un rol específico en un complejo
 * @param {number} userId - ID del usuario
 * @param {number} complejoId - ID del complejo
 * @param {string|Array<string>} roles - Rol o roles permitidos
 * @returns {Promise<boolean>} true si tiene el rol, false si no
 */
export const hasRole = async (userId, complejoId, roles) => {
  const rolesArray = Array.isArray(roles) ? roles : [roles];
  
  const access = await UsuarioComplejo.findOne({
    where: {
      user_id: userId,
      complejo_id: complejoId
    }
  });

  if (!access) {
    return false;
  }

  return rolesArray.includes(access.rol_en_complejo);
};
