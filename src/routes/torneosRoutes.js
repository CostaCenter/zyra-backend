import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { uploadTorneoPhoto, handleMulterError } from '../middlewares/uploadMiddleware.js';
import {
  listTorneos,
  getMisTorneos,
  getTorneosInscritos,
  createTorneo,
  updateTorneoPhoto,
  updateTorneo,
  getTorneoById,
  getPerfilPublicoTorneo,
  iniciarTorneo,
  createFaseTorneo,
  generarFixtureFase,
  generarEliminatoriasTorneo,
  createGrupoDivision,
  asignarEquipoGrupo,
  quitarEquipoGrupo,
  buscarTorneoPorCodigo,
  getPosicionesTorneo,
  getHorarioEstadoTorneo,
} from '../controllers/torneosController.js';
import {
  solicitarInscripcion,
  invitarInscripcion,
  responderInscripcion,
  listInscripcionesTorneo,
  getInscripcionDetalle,
} from '../controllers/torneoInscripcionesController.js';
import {
  listArbitrosTorneo,
  addArbitroTorneo,
  removeArbitroTorneo,
  getInvitacionCuerpoArbitral,
  responderInvitacionCuerpoArbitralController,
} from '../controllers/torneoArbitrosController.js';
import {
  getPlantillaTorneo,
  putPlantillaTorneo,
} from '../controllers/torneoPlantillaController.js';

/**
 * Rutas de Torneos - Zyra
 * /api/torneos
 *
 * GET  /api/torneos                              → Lista con filtros opcionales
 * GET  /api/torneos/mios                         → Torneos creados por el usuario autenticado
 * GET  /api/torneos/inscritos                    → Torneos con inscripción ACEPTADA en equipos del usuario
 * GET  /api/torneos/buscar-por-codigo/:codigo    → Buscar torneo privado por código de acceso
 * POST /api/torneos                              → Crear torneo
 * GET  /api/torneos/:torneo_id                   → Torneo con fases y grupos anidados
 * GET  /api/torneos/:torneo_id/perfil            → Perfil público (partidos, equipos, bracket)
 * GET  /api/torneos/:torneo_id/inscripciones     → Listar inscripciones (solo organizador)
 * POST /api/torneos/:torneo_id/inscripciones/solicitar → Solicitar inscripción (capitán)
 * POST /api/torneos/:torneo_id/inscripciones/invitar   → Invitar equipo (organizador)
 * PUT  /api/torneos/:torneo_id/inscripciones/:inscripcion_id/responder → Responder solicitud/invitación
 * PUT  /api/torneos/:torneo_id                      → Editar torneo (solo organizador)
 * PUT  /api/torneos/:torneo_id/iniciar              → Iniciar torneo (organizador, PLANEACION/INSCRIPCIONES → EN_CURSO)
 * GET  /api/torneos/:torneo_id/posiciones        → Tabla de posiciones (opcional ?grupo_division_id=)
 * POST /api/torneos/:torneo_id/fases            → Crear fase (solo creador)
 * POST /api/torneos/:torneo_id/fases/:fase_id/generar-fixture → Generar fixture (solo organizador)
 * POST /api/torneos/:torneo_id/fases/:fase_id/grupos → Crear grupo/división (solo creador)
 * POST /api/torneos/:torneo_id/grupos/:grupo_id/equipos → Asignar equipo a grupo (solo creador)
 */

const router = express.Router();

router.get('/mios', verifyToken, getMisTorneos);
router.get('/inscritos', verifyToken, getTorneosInscritos);
router.get('/buscar-por-codigo/:codigo', verifyToken, buscarTorneoPorCodigo);
router.post('/', verifyToken, createTorneo);
router.get('/:torneo_id/inscripciones', verifyToken, listInscripcionesTorneo);
router.get('/:torneo_id/inscripciones/:inscripcion_id', verifyToken, getInscripcionDetalle);
router.get('/:torneo_id/arbitros', verifyToken, listArbitrosTorneo);
router.get('/:torneo_id/arbitros/:registro_id/invitacion', verifyToken, getInvitacionCuerpoArbitral);
router.put('/:torneo_id/arbitros/:registro_id/responder', verifyToken, responderInvitacionCuerpoArbitralController);
router.post('/:torneo_id/arbitros', verifyToken, addArbitroTorneo);
router.delete('/:torneo_id/arbitros/:usuario_id', verifyToken, removeArbitroTorneo);
router.get('/:torneo_id/perfil', verifyToken, getPerfilPublicoTorneo);
router.get('/:torneo_id/horario-estado', verifyToken, getHorarioEstadoTorneo);
router.get('/:torneo_id/equipos/:team_id/plantilla', verifyToken, getPlantillaTorneo);
router.put('/:torneo_id/equipos/:team_id/plantilla', verifyToken, putPlantillaTorneo);
router.get('/:torneo_id/posiciones', verifyToken, getPosicionesTorneo);
router.post('/:torneo_id/inscripciones/solicitar', verifyToken, solicitarInscripcion);
router.post('/:torneo_id/inscripciones/invitar', verifyToken, invitarInscripcion);
router.put('/:torneo_id/inscripciones/:inscripcion_id/responder', verifyToken, responderInscripcion);
router.put('/:torneo_id/iniciar', verifyToken, iniciarTorneo);
router.put('/:torneo_id', verifyToken, updateTorneo);
router.put(
  '/:torneo_id/photo',
  verifyToken,
  (req, res, next) => {
    uploadTorneoPhoto(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  updateTorneoPhoto
);
router.get('/:torneo_id', verifyToken, getTorneoById);
router.post('/:torneo_id/fases', verifyToken, createFaseTorneo);
router.post('/:torneo_id/fases/:fase_id/generar-fixture', verifyToken, generarFixtureFase);
router.post('/:torneo_id/generar-eliminatorias', verifyToken, generarEliminatoriasTorneo);
router.post('/:torneo_id/fases/:fase_id/grupos', verifyToken, createGrupoDivision);
router.post('/:torneo_id/grupos/:grupo_id/equipos', verifyToken, asignarEquipoGrupo);
router.delete('/:torneo_id/grupos/:grupo_id/equipos/:team_id', verifyToken, quitarEquipoGrupo);
router.get('/', verifyToken, listTorneos);

export default router;
