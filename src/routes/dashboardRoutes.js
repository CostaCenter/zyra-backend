import express from 'express';
import { getDashboardInit, getDashboardCancha, getCanchaReservas } from '../controllers/dashboardController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { verifyDashboardAccess } from '../middlewares/dashboardMiddleware.js';

const router = express.Router();

/**
 * Rutas Dashboard - Zyra
 */

// GET /api/dashboard/init — datos iniciales del día
router.get('/init', verifyToken, verifyDashboardAccess, getDashboardInit);

// GET /api/dashboard/:complejoId/:canchaId — detalle cancha + agenda + reservas_semana
// Query: fecha (YYYY-MM-DD, opcional)
router.get('/:complejoId/:canchaId', verifyToken, getDashboardCancha);

// GET /api/dashboard/:complejoId/:canchaId/reservas — reservas extendidas + analytics
// Query: rango = 30dias | mes
router.get('/:complejoId/:canchaId/reservas', verifyToken, getCanchaReservas);

export default router;
