import { Router } from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  registrarToken,
  eliminarToken,
} from '../controllers/dispositivosPushController.js';

const router = Router();

router.post('/', verifyToken, registrarToken);
router.delete('/', verifyToken, eliminarToken);

export default router;
