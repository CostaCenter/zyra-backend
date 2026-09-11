import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  getResumenInteraccion,
  putReaccion,
  getComentarios,
  postComentario,
  deleteComentario,
  postReporte,
  getEncuesta,
  postVotoEncuesta,
} from '../controllers/interaccionSocialController.js';

const router = express.Router();

router.post('/reportes', verifyToken, postReporte);
router.get('/:contenido_tipo/:contenido_id', verifyToken, getResumenInteraccion);
router.put('/:contenido_tipo/:contenido_id/reaccion', verifyToken, putReaccion);
router.get('/:contenido_tipo/:contenido_id/comentarios', verifyToken, getComentarios);
router.post('/:contenido_tipo/:contenido_id/comentarios', verifyToken, postComentario);
router.delete('/comentarios/:comentario_id', verifyToken, deleteComentario);
router.post('/:contenido_tipo/:contenido_id/reportar', verifyToken, postReporte);
router.get('/:contenido_tipo/:contenido_id/encuesta', verifyToken, getEncuesta);
router.post('/:contenido_tipo/:contenido_id/encuesta/voto', verifyToken, postVotoEncuesta);

export default router;
