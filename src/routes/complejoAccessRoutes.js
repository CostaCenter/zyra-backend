import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  grantUserAccess,
  revokeUserAccess,
  getComplejoUsers,
  getUserComplejos
} from '../controllers/complejoAccessController.js';

const router = express.Router();

/**
 * Rutas para gestionar accesos de usuarios a complejos
 * Todas las rutas requieren autenticación
 */

// Otorgar acceso a un usuario a un complejo
router.post('/complejos/:complejoId/acceso', verifyToken, grantUserAccess);

// Revocar acceso de un usuario a un complejo
router.delete('/complejos/:complejoId/acceso/:userId', verifyToken, revokeUserAccess);

// Obtener todos los usuarios con acceso a un complejo
router.get('/complejos/:complejoId/acceso', verifyToken, getComplejoUsers);

// Obtener todos los complejos a los que un usuario tiene acceso
router.get('/usuarios/:userId/complejos', verifyToken, getUserComplejos);

export default router;
