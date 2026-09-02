import { checkAccess, hasRole } from '../services/complejoAccessService.js';

/**
 * Middleware para verificar que un usuario tiene acceso a un complejo
 * Busca el complejoId en params, body o query
 */
export const requireComplejoAccess = async (req, res, next) => {
  try {
    const complejoId = req.params.complejoId || 
                       req.body.complejoId || 
                       req.query.complejoId ||
                       req.params.complejo_id ||
                       req.body.complejo_id;

    if (!complejoId) {
      return res.status(400).json({
        success: false,
        message: 'complejoId es requerido'
      });
    }

    const access = await checkAccess(req.user.id, parseInt(complejoId));

    if (!access) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este complejo'
      });
    }

    // Agregar el acceso al request para uso posterior
    req.complejoAccess = access;
    next();

  } catch (error) {
    console.error('Error en middleware de acceso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar acceso al complejo'
    });
  }
};

/**
 * Middleware para verificar que un usuario tiene un rol específico en un complejo
 * @param {string|Array<string>} requiredRoles - Rol o roles requeridos
 */
export const requireComplejoRole = (requiredRoles) => {
  return async (req, res, next) => {
    try {
      const complejoId = req.params.complejoId || 
                         req.body.complejoId || 
                         req.query.complejoId ||
                         req.params.complejo_id ||
                         req.body.complejo_id;

      if (!complejoId) {
        return res.status(400).json({
          success: false,
          message: 'complejoId es requerido'
        });
      }

      const userHasRole = await hasRole(
        req.user.id,
        parseInt(complejoId),
        requiredRoles
      );

      if (!userHasRole) {
        return res.status(403).json({
          success: false,
          message: 'No tienes los permisos necesarios en este complejo'
        });
      }

      next();

    } catch (error) {
      console.error('Error en middleware de rol:', error);
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos'
      });
    }
  };
};
