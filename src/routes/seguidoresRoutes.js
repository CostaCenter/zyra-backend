import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { seguir, dejarDeSeguir } from '../controllers/seguidoresController.js';

/**
 * Rutas de Seguidores - Zyra
 * /api/seguidores
 *
 * POST   /api/seguidores     → Seguir usuario o equipo
 * DELETE /api/seguidores/:id → Dejar de seguir
 */

const router = express.Router();

router.post('/', verifyToken, seguir);
router.delete('/:id', verifyToken, dejarDeSeguir);

export default router;
