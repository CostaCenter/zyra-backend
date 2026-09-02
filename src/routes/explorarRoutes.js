import express from 'express';
import {
  buscarCanchas,
  buscarCanchasPaginado,
  obtenerEstadisticas,
  listarDeportes,
  listarUbicaciones,
  buscarComplejos,
  obtenerDisponibilidadComplejo
} from '../controllers/explorarController.js';

/**
 * Rutas de Exploración y Búsqueda - Zyra
 * /api/explorar
 * 
 * Todas las rutas son públicas (no requieren autenticación)
 */

const router = express.Router();

// GET /api/explorar/canchas - Buscar canchas con filtros flexibles
// Query params: q, deporte, sport_id, fecha, ubicacion, estado
router.get('/canchas', buscarCanchas);

// GET /api/explorar/canchas/paginado - Buscar canchas con paginación
// Query params: q, deporte, sport_id, fecha, ubicacion, estado, page, limit
router.get('/canchas/paginado', buscarCanchasPaginado);

// GET /api/explorar/estadisticas - Obtener estadísticas de búsqueda
// Query params: mismos que /canchas
router.get('/estadisticas', obtenerEstadisticas);

// GET /api/explorar/deportes - Listar todos los deportes disponibles
router.get('/deportes', listarDeportes);

// GET /api/explorar/ubicaciones - Listar todas las ubicaciones disponibles
router.get('/ubicaciones', listarUbicaciones);

// GET /api/explorar/complejos - Complejos con canchas disponibles (filtros + paginación)
// Query params: q, sport_id, deporte, dia, ubicacion, precio_min, precio_max, page, limit
router.get('/complejos', buscarComplejos);

// GET /api/explorar/complejos/:complejoId/disponibilidad - Disponibilidad completa de canchas de un complejo
// Query params: fecha (requerido), sport_id (opcional), deporte (opcional), hora_inicio (opcional como referencia)
// Devuelve TODAS las franjas horarias del día para cada cancha con estado LIBRE/OCUPADA y precios
router.get('/complejos/:complejoId/disponibilidad', obtenerDisponibilidadComplejo);

export default router;
