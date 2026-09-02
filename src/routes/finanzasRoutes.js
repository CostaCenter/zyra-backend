import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { getFinanzasResumen } from '../controllers/finanzasController.js';

const router = express.Router();

/**
 * GET /api/complejos/:id/finanzas/resumen
 * Resumen financiero del complejo calculado desde reservas
 */
router.get('/:id/finanzas/resumen', verifyToken, getFinanzasResumen);

export default router;
