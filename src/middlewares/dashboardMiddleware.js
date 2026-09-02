import { UsuarioComplejo } from '../db/db.js';

/**
 * Middleware de Autorización Dashboard - Zyra
 * Valida que el usuario tenga permisos para acceder al dashboard de un complejo
 */

/**
 * Verifica que el usuario no sea JUGADOR y tenga acceso al complejo
 */
export const verifyDashboardAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const complejoId = req.query.complejo_id;

    // Validar que se proporcione el complejo_id
    if (!complejoId) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro complejo_id es obligatorio'
      });
    }

    // Validar que el usuario no sea JUGADOR
    if (userRole === 'JUGADOR') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Los jugadores no tienen permisos para acceder al dashboard'
      });
    }

    // Verificar que el usuario tiene acceso al complejo en la tabla intermedia
    const accesoComplejo = await UsuarioComplejo.findOne({
      where: {
        user_id: userId,
        complejo_id: complejoId
      }
    });

    if (!accesoComplejo) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este complejo'
      });
    }

    // Adjuntar el complejo_id al request para uso posterior
    req.complejoId = parseInt(complejoId, 10);

    next();

  } catch (error) {
    console.error('Error al verificar acceso al dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar permisos de acceso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
