import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  getPerfilDeportivo,
  upsertPerfilDeportivo
} from '../controllers/perfilDeportivoController.js';

/**
 * Rutas de Perfil Deportivo - Zyra
 * /api/perfil-deportivo
 *
 * GET /api/perfil-deportivo/:sport_id → Perfil del usuario autenticado para un deporte
 * PUT /api/perfil-deportivo/:sport_id → Crear/actualizar posicion_principal y pierna_habil
 */

const router = express.Router();

router.get('/:sport_id', verifyToken, getPerfilDeportivo);
router.put('/:sport_id', verifyToken, upsertPerfilDeportivo);

export default router;
