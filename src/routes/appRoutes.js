import { Router } from 'express';
import { getAppVersionConfig } from '../controllers/appVersionController.js';

const router = Router();

/** GET /api/app/version — versión mínima / latest para clientes móviles */
router.get('/version', getAppVersionConfig);

export default router;
