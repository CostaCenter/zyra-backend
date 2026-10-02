import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { uploadTorneoPhoto, handleMulterError } from '../middlewares/uploadMiddleware.js';
import {
  getMisTeams,
  createTeam,
  getTeamById,
  getTeamsDestacados,
  getPerfilPublicoEquipo,
  invitarMiembroEquipo,
  responderInvitacionEquipo,
  updateTeam,
  updateTeamLogo,
} from '../controllers/teamsController.js';
import { updateJugadorDatosEquipo } from '../controllers/statsPorPartidoController.js';

/**
 * Rutas de Equipos - Zyra
 * /api/teams
 *
 * GET  /api/teams/mios                                    → Equipos del usuario autenticado
 * POST /api/teams                                         → Crear equipo
 * PUT  /api/teams/:team_id                                → Actualizar nombre
 * PUT  /api/teams/:team_id/logo                           → Subir logo
 * GET  /api/teams/:team_id/perfil                         → Perfil público del equipo
 * GET  /api/teams/:team_id                                → Detalle con miembros
 * POST /api/teams/:team_id/invitar                        → Invitar usuario (solo capitán)
 * PUT  /api/teams/:team_id/miembros/:miembro_id/responder → Aceptar/rechazar invitación
 * PUT  /api/teams/:team_id/jugadores/:user_id/datos      → Dorsal, posición, mano hábil
 */

const router = express.Router();

router.get('/mios', verifyToken, getMisTeams);
router.get('/destacados', verifyToken, getTeamsDestacados);
router.post('/', verifyToken, createTeam);
router.put('/:team_id', verifyToken, updateTeam);
router.put(
  '/:team_id/logo',
  verifyToken,
  (req, res, next) => {
    uploadTorneoPhoto(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  updateTeamLogo
);
router.get('/:team_id/perfil', verifyToken, getPerfilPublicoEquipo);
router.put('/:team_id/jugadores/:user_id/datos', verifyToken, updateJugadorDatosEquipo);
router.get('/:team_id', verifyToken, getTeamById);
router.post('/:team_id/invitar', verifyToken, invitarMiembroEquipo);
router.put('/:team_id/miembros/:miembro_id/responder', verifyToken, responderInvitacionEquipo);

export default router;
