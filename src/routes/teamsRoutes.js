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
  updateTeamLogo,
} from '../controllers/teamsController.js';

/**
 * Rutas de Equipos - Zyra
 * /api/teams
 *
 * GET  /api/teams/mios                                    → Equipos del usuario autenticado
 * POST /api/teams                                         → Crear equipo
 * PUT  /api/teams/:team_id/logo                           → Subir logo (solo capitán)
 * GET  /api/teams/:team_id/perfil                         → Perfil público del equipo
 * GET  /api/teams/:team_id                                → Detalle con miembros
 * POST /api/teams/:team_id/invitar                        → Invitar usuario (solo capitán)
 * PUT  /api/teams/:team_id/miembros/:miembro_id/responder → Aceptar/rechazar invitación
 */

const router = express.Router();

router.get('/mios', verifyToken, getMisTeams);
router.get('/destacados', verifyToken, getTeamsDestacados);
router.post('/', verifyToken, createTeam);
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
router.get('/:team_id', verifyToken, getTeamById);
router.post('/:team_id/invitar', verifyToken, invitarMiembroEquipo);
router.put('/:team_id/miembros/:miembro_id/responder', verifyToken, responderInvitacionEquipo);

export default router;
