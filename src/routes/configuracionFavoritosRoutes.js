import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  create,
  getByComplejo,
  getByCancha,
  getById,
  update,
  remove
} from '../controllers/configuracionFavoritosController.js';

/**
 * Rutas de Configuraciones de Horarios Favoritos - Zyra
 * /api/precios/favoritos
 * 
 * Todas las rutas requieren autenticación
 * 
 * POST   /api/precios/favoritos - Crear configuración favorita
 * GET    /api/precios/favoritos/complejo/:complejoId - Obtener todas las configuraciones de un complejo
 * GET    /api/precios/favoritos/cancha/:canchaId - Obtener la configuración favorita de una cancha
 * GET    /api/precios/favoritos/:id - Obtener una configuración por ID
 * PUT    /api/precios/favoritos/:id - Actualizar una configuración
 * DELETE /api/precios/favoritos/:id - Eliminar una configuración
 */

const router = express.Router();

// Todas las rutas están protegidas (requieren autenticación)

// Crear configuración favorita
router.post('/', verifyToken, create);

// Obtener todas las configuraciones de un complejo
router.get('/complejo/:complejoId', verifyToken, getByComplejo);

// Obtener la configuración favorita de una cancha
router.get('/cancha/:canchaId', verifyToken, getByCancha);

// Obtener una configuración por ID
router.get('/:id', verifyToken, getById);

// Actualizar una configuración
router.put('/:id', verifyToken, update);

// Eliminar una configuración
router.delete('/:id', verifyToken, remove);

export default router;
