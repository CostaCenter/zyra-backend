import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  invitarMiembroComplejo,
  obtenerMiembrosComplejo,
  actualizarMiembroComplejo,
} from '../controllers/miembrosController.js';

const router = express.Router();

router.get('/', verifyToken, obtenerMiembrosComplejo);
router.post('/invitar', verifyToken, invitarMiembroComplejo);
router.put('/:id', verifyToken, actualizarMiembroComplejo);

export default router;
