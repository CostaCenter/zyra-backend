import {
  grantAccess,
  revokeAccess,
  getUsersWithAccess,
  getUserComplexes,
  checkAccess,
  hasRole
} from '../services/complejoAccessService.js';

/**
 * Controller para gestionar accesos de usuarios a complejos
 */

/**
 * POST /api/complejos/:complejoId/acceso
 * Otorgar acceso a un usuario a un complejo
 */
export const grantUserAccess = async (req, res) => {
  try {
    const { complejoId } = req.params;
    const { userId, rol } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId es requerido'
      });
    }

    // Verificar que el usuario autenticado tenga permisos (DUEÑO o ADMIN)
    const requesterHasPermission = await hasRole(
      req.user.id,
      parseInt(complejoId),
      ['DUEÑO', 'ADMIN']
    );

    if (!requesterHasPermission) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para otorgar accesos en este complejo'
      });
    }

    const access = await grantAccess(
      parseInt(userId),
      parseInt(complejoId),
      rol || 'ACCESO'
    );

    res.status(201).json({
      success: true,
      message: 'Acceso otorgado exitosamente',
      data: access
    });

  } catch (error) {
    console.error('Error al otorgar acceso:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al otorgar acceso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE /api/complejos/:complejoId/acceso/:userId
 * Revocar acceso de un usuario a un complejo
 */
export const revokeUserAccess = async (req, res) => {
  try {
    const { complejoId, userId } = req.params;

    // Verificar que el usuario autenticado tenga permisos (DUEÑO o ADMIN)
    const requesterHasPermission = await hasRole(
      req.user.id,
      parseInt(complejoId),
      ['DUEÑO', 'ADMIN']
    );

    if (!requesterHasPermission) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para revocar accesos en este complejo'
      });
    }

    // No permitir que el dueño se elimine a sí mismo
    const targetAccess = await checkAccess(parseInt(userId), parseInt(complejoId));
    if (targetAccess && targetAccess.rol_en_complejo === 'DUEÑO') {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar al dueño del complejo'
      });
    }

    const deleted = await revokeAccess(parseInt(userId), parseInt(complejoId));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Acceso no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Acceso revocado exitosamente'
    });

  } catch (error) {
    console.error('Error al revocar acceso:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al revocar acceso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/complejos/:complejoId/acceso
 * Obtener todos los usuarios con acceso a un complejo
 */
export const getComplejoUsers = async (req, res) => {
  try {
    const { complejoId } = req.params;

    // Verificar que el usuario autenticado tenga acceso al complejo
    const hasAccess = await checkAccess(req.user.id, parseInt(complejoId));
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este complejo'
      });
    }

    const users = await getUsersWithAccess(parseInt(complejoId));

    res.status(200).json({
      success: true,
      data: users
    });

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener usuarios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/usuarios/:userId/complejos
 * Obtener todos los complejos a los que un usuario tiene acceso
 */
export const getUserComplejos = async (req, res) => {
  try {
    const { userId } = req.params;

    // Solo permitir que el usuario obtenga sus propios complejos o admins
    if (req.user.id !== parseInt(userId) && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver los complejos de otro usuario'
      });
    }

    const complejos = await getUserComplexes(parseInt(userId));

    res.status(200).json({
      success: true,
      data: complejos
    });

  } catch (error) {
    console.error('Error al obtener complejos:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener complejos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
