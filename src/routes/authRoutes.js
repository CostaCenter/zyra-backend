import express from 'express';
import { register, login, loginDashboard, logout } from '../controllers/authController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * Rutas de Autenticación - Zyra
 * 
 * POST /auth/register - Registrar nuevo usuario
 * POST /auth/login - Iniciar sesión
 * POST /auth/logout - Cerrar sesión (requiere token)
 * GET /auth/me - Obtener datos del usuario autenticado
 */

// Registro de usuario
router.post('/register', register);

// Login de usuario (app móvil)
router.post('/login', login);

// Login del dashboard web
router.post('/login/dashboard', loginDashboard);

// Logout (invalida push token opcional en servidor; JWT es stateless)
router.post('/logout', verifyToken, logout);

// Ruta protegida de ejemplo: obtener datos del usuario actual
router.get('/me', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Usuario autenticado',
    data: req.user
  });
});

export default router;
