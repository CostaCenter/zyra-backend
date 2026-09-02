import jwt from 'jsonwebtoken';
import { User } from '../db/db.js';

/**
 * Middleware de Autenticación - Zyra
 * Verifica el token JWT en las peticiones protegidas
 */

/**
 * Middleware para verificar token JWT
 * Protege rutas que requieren autenticación
 */
export const verifyToken = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No se proporcionó token de autenticación'
      });
    }

    // El formato esperado es: "Bearer TOKEN"
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar el usuario en la base de datos
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Adjuntar los datos del usuario al request
    req.user = user;
    req.userId = user.id;

    next();

  } catch (error) {
    console.error('Error al verificar token:', error);

    // Token expirado
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }

    // Token inválido
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al verificar token'
    });
  }
};

/**
 * Middleware para verificar roles específicos
 * Uso: verifyRole(['admin', 'owner'])
 */
export const verifyRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
  };
};
