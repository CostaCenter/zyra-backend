import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { uploadPublicacionMedia, uploadTorneoPhoto, uploadAnuncioImagen, handleMulterError } from '../middlewares/uploadMiddleware.js';
import {
  createClub,
  getMisClubes,
  getPerfilPublicoClub,
  updateClub,
  updateClubLogo,
  createDivision,
  updateDivision,
  deleteDivision,
  solicitarUnionClub,
  listSolicitudesClub,
  getSolicitudClubDetalle,
  responderSolicitudClub,
} from '../controllers/clubsController.js';
import {
  getNovedadesClubes,
  getMiembrosClub,
  getAnunciosClub,
  getAnuncioClub,
  deleteAnuncioClub,
  postAnuncioClub,
  getEventosDivision,
  postEventoDivision,
  getEntrenamientosClub,
  getResumenEntrenamientosClub,
  getEventoDetalle,
  putEventoEntrenamiento,
  postFinalizarEventoEntrenamiento,
  getLugaresDivision,
  postConfirmacionEvento,
  getJugadoresDivision,
  getDetalleDivision,
  postAtletaDivision,
  putAtletaDivision,
  deleteAtletaDivision,
  postInvitacionDivision,
  getInvitacionDivisionDetalle,
  putResponderInvitacionDivision,
  postEquipoCompetenciaDivision,
  getPlantillaEquipoDivision,
  putPlantillaEquipoDivision,
  postAsistenciaEvento,
  getMetricasClub,
  postEvaluacionEvento,
  postPracticaDivision,
  postIniciarFogueoEvento,
  postUnirsePorCodigo,
  getMembresiaSolicitudes,
  getMembresiaSolicitudDetalle,
  putResponderMembresiaSolicitud,
} from '../controllers/clubGestionController.js';
import {
  getDestacadosClub,
  postDestacadoClub,
  putDestacadoClub,
  deleteDestacadoClub,
  postDestacadoItem,
  deleteDestacadoItem,
} from '../controllers/clubDestacadosController.js';

const router = express.Router();

const withUpload = (uploader, fieldName) => (req, res, next) => {
  uploader(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
};

router.get('/mios', verifyToken, getMisClubes);
router.get('/novedades', verifyToken, getNovedadesClubes);
router.post('/unirse-por-codigo', verifyToken, postUnirsePorCodigo);
router.post('/', verifyToken, createClub);
router.get('/:club_id/perfil', verifyToken, getPerfilPublicoClub);
router.put('/:club_id', verifyToken, updateClub);
router.put(
  '/:club_id/logo',
  verifyToken,
  withUpload(uploadTorneoPhoto),
  updateClubLogo,
);

router.get('/:club_id/destacados', verifyToken, getDestacadosClub);
router.post(
  '/:club_id/destacados',
  verifyToken,
  withUpload(uploadTorneoPhoto),
  postDestacadoClub,
);
router.put(
  '/:club_id/destacados/:destacado_id',
  verifyToken,
  withUpload(uploadTorneoPhoto),
  putDestacadoClub,
);
router.delete('/:club_id/destacados/:destacado_id', verifyToken, deleteDestacadoClub);
router.post(
  '/:club_id/destacados/:destacado_id/items',
  verifyToken,
  withUpload(uploadPublicacionMedia),
  postDestacadoItem,
);
router.delete(
  '/:club_id/destacados/:destacado_id/items/:item_id',
  verifyToken,
  deleteDestacadoItem,
);

router.get('/:club_id/miembros', verifyToken, getMiembrosClub);
router.get('/:club_id/anuncios', verifyToken, getAnunciosClub);
router.get('/:club_id/anuncios/:anuncio_id', verifyToken, getAnuncioClub);
router.delete('/:club_id/anuncios/:anuncio_id', verifyToken, deleteAnuncioClub);
router.post(
  '/:club_id/anuncios',
  verifyToken,
  withUpload(uploadAnuncioImagen),
  postAnuncioClub,
);
router.get('/:club_id/metricas', verifyToken, getMetricasClub);

router.post('/:club_id/divisiones', verifyToken, createDivision);
router.put('/:club_id/divisiones/:division_id', verifyToken, updateDivision);
router.delete('/:club_id/divisiones/:division_id', verifyToken, deleteDivision);
router.get('/:club_id/divisiones/:division_id/detalle', verifyToken, getDetalleDivision);
router.get('/:club_id/entrenamientos', verifyToken, getEntrenamientosClub);
router.get('/:club_id/entrenamientos/resumen', verifyToken, getResumenEntrenamientosClub);
router.get('/:club_id/eventos/:evento_id', verifyToken, getEventoDetalle);
router.put('/:club_id/eventos/:evento_id', verifyToken, putEventoEntrenamiento);
router.post('/:club_id/eventos/:evento_id/finalizar', verifyToken, postFinalizarEventoEntrenamiento);
router.post('/:club_id/eventos/:evento_id/confirmacion', verifyToken, postConfirmacionEvento);

router.get('/:club_id/divisiones/:division_id/eventos', verifyToken, getEventosDivision);
router.post('/:club_id/divisiones/:division_id/eventos', verifyToken, postEventoDivision);
router.get('/:club_id/divisiones/:division_id/lugares', verifyToken, getLugaresDivision);
router.get('/:club_id/divisiones/:division_id/jugadores', verifyToken, getJugadoresDivision);
router.post('/:club_id/divisiones/:division_id/atletas', verifyToken, postAtletaDivision);
router.post('/:club_id/divisiones/:division_id/invitaciones', verifyToken, postInvitacionDivision);
router.get('/:club_id/divisiones/:division_id/invitaciones/:invitacion_id', verifyToken, getInvitacionDivisionDetalle);
router.put('/:club_id/divisiones/:division_id/invitaciones/:invitacion_id/responder', verifyToken, putResponderInvitacionDivision);
router.put('/:club_id/divisiones/:division_id/atletas/:atleta_id', verifyToken, putAtletaDivision);
router.delete('/:club_id/divisiones/:division_id/atletas/:atleta_id', verifyToken, deleteAtletaDivision);
router.post('/:club_id/divisiones/:division_id/equipos', verifyToken, postEquipoCompetenciaDivision);
router.get('/:club_id/divisiones/:division_id/equipos/:team_id/plantilla', verifyToken, getPlantillaEquipoDivision);
router.put('/:club_id/divisiones/:division_id/equipos/:team_id/plantilla', verifyToken, putPlantillaEquipoDivision);
router.post('/:club_id/divisiones/:division_id/practica', verifyToken, postPracticaDivision);

router.post('/:club_id/eventos/:evento_id/asistencia', verifyToken, postAsistenciaEvento);
router.post('/:club_id/eventos/:evento_id/fogueo/iniciar', verifyToken, postIniciarFogueoEvento);
router.post('/:club_id/eventos/:evento_id/evaluaciones', verifyToken, postEvaluacionEvento);

router.get('/:club_id/membresia-solicitudes', verifyToken, getMembresiaSolicitudes);
router.get('/:club_id/membresia-solicitudes/:solicitud_id', verifyToken, getMembresiaSolicitudDetalle);
router.put('/:club_id/membresia-solicitudes/:solicitud_id/responder', verifyToken, putResponderMembresiaSolicitud);

router.get('/:club_id/solicitudes', verifyToken, listSolicitudesClub);
router.get('/:club_id/solicitudes/:solicitud_id', verifyToken, getSolicitudClubDetalle);
router.post('/:club_id/solicitudes', verifyToken, solicitarUnionClub);
router.put('/:club_id/solicitudes/:solicitud_id/responder', verifyToken, responderSolicitudClub);

export default router;
