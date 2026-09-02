import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  getMiPerfilDeportivo,
  updateMiPerfilDeportivo
} from '../controllers/perfilDeportivoController.js';
import { buscarUsuariosPorNick, getUsuariosDestacados } from '../controllers/usuariosController.js';
import {
  getPerfilPublico,
  getMiPerfil,
  updateMiPerfil,
  updateMiPerfilPhoto,
  updateMiPerfilPortada,
  listarSeguidores,
  listarSeguidos,
  getEquiposUsuario,
} from '../controllers/perfilPublicoController.js';
import { getStatsPorPartido } from '../controllers/statsPorPartidoController.js';
import { uploadUsuarioPhoto, handleMulterError } from '../middlewares/uploadMiddleware.js';

/**
 * Rutas de Usuario - Zyra
 * /api/usuarios
 *
 * GET /api/usuarios/buscar?nick=X                    → Búsqueda parcial por nick
 * GET /api/usuarios/mi-perfil                           → Perfil propio (bio, etc.)
 * PUT /api/usuarios/mi-perfil                           → Actualizar name/bio
 * PUT /api/usuarios/mi-perfil/photo                   → Subir avatar
 * PUT /api/usuarios/mi-perfil/portada                 → Subir foto de portada
 * GET /api/usuarios/mi-perfil-deportivo?sport_id=X   → Ficha deportiva + selector de deportes
 * PUT /api/usuarios/mi-perfil-deportivo              → Crear/actualizar ficha deportiva
 * GET /api/usuarios/:user_id/perfil?sport_id=X       → Perfil público + publicaciones
 * GET /api/usuarios/:user_id/seguidores              → Seguidores del usuario
 * GET /api/usuarios/:user_id/equipos?sport_id=X      → Equipos confirmados del jugador
 * GET /api/usuarios/:user_id/stats-por-partido?team_id=X → Puntos/goles por partido
 * GET /api/usuarios/:user_id/seguidos                → Usuarios/equipos que sigue
 */

const router = express.Router();

router.get('/buscar', verifyToken, buscarUsuariosPorNick);
router.get('/destacados', verifyToken, getUsuariosDestacados);
router.get('/mi-perfil', verifyToken, getMiPerfil);
router.put('/mi-perfil', verifyToken, updateMiPerfil);
router.put('/mi-perfil/photo', verifyToken, uploadUsuarioPhoto, handleMulterError, updateMiPerfilPhoto);
router.put('/mi-perfil/portada', verifyToken, uploadUsuarioPhoto, handleMulterError, updateMiPerfilPortada);
router.get('/mi-perfil-deportivo', verifyToken, getMiPerfilDeportivo);
router.put('/mi-perfil-deportivo', verifyToken, updateMiPerfilDeportivo);

router.get('/:user_id/perfil', verifyToken, getPerfilPublico);
router.get('/:user_id/equipos', verifyToken, getEquiposUsuario);
router.get('/:user_id/stats-por-partido', verifyToken, getStatsPorPartido);
router.get('/:user_id/seguidores', verifyToken, listarSeguidores);
router.get('/:user_id/seguidos', verifyToken, listarSeguidos);

export default router;
