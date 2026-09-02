import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { uploadPublicacionMedia, handleMulterError } from '../middlewares/uploadMiddleware.js';
import {
  crearPublicacion,
  listarEtiquetasPendientes,
  listarPublicacionesRecientes,
  listarPublicacionesFeed,
  responderEtiqueta
} from '../controllers/publicacionesController.js';

/**
 * Rutas de Publicaciones - Zyra
 * /api/publicaciones
 *
 * POST /api/publicaciones                         → Crear publicación (multipart)
 * GET  /api/publicaciones/etiquetas/pendientes    → Etiquetas pendientes del usuario
 * PUT  /api/publicaciones/etiquetas/:id/responder → Confirmar/rechazar etiqueta
 */

const router = express.Router();

router.post(
  '/',
  verifyToken,
  (req, res, next) => {
    uploadPublicacionMedia(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  crearPublicacion
);

router.get('/feed', verifyToken, listarPublicacionesFeed);
router.get('/recientes', verifyToken, listarPublicacionesRecientes);
router.get('/etiquetas/pendientes', verifyToken, listarEtiquetasPendientes);
router.put('/etiquetas/:id/responder', verifyToken, responderEtiqueta);

export default router;
