import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { getBuscar } from '../controllers/buscarController.js';

/**
 * GET /api/buscar?q=X&tipo=todo|personas|equipos|torneos
 */
const router = express.Router();

router.get('/', verifyToken, getBuscar);

export default router;
