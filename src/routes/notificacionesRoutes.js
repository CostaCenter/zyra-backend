import { Router } from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  listarNotificaciones,
  obtenerConteoNoLeidas,
  marcarLeida,
  marcarTodasLeidasHandler,
  eliminarNotificacionHandler,
} from '../controllers/notificacionesController.js';

const router = Router();

router.get('/', verifyToken, listarNotificaciones);
router.get('/no-leidas', verifyToken, obtenerConteoNoLeidas);
router.put('/marcar-todas-leidas', verifyToken, marcarTodasLeidasHandler);
router.put('/:id/leida', verifyToken, marcarLeida);
router.delete('/:id', verifyToken, eliminarNotificacionHandler);

export default router;
