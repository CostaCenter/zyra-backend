import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  asignarArbitroPartido,
  getAsignacionArbitroDetalle,
  confirmarAsignacionArbitro,
  iniciarPartido,
  getMarcadorPartido,
  getMapasCalorPartido,
  getMisArbitrajes,
  definirEquipoQueSacaInicial,
  definirEquipoQueSacaSet,
} from '../controllers/partidosController.js';
import { registrarSetPartido, registrarPuntoPartido, deshacerUltimoPuntoPartido, registrarCambioPartido, registrarSancionPartido, actualizarDetalleEventoPartido } from '../controllers/eventosController.js';
import {
  proponerNomina,
  validarNomina,
  listarNominasPartido
} from '../controllers/nominasController.js';

/**
 * Rutas de Partidos - Zyra
 * /api/partidos
 *
 * PUT  /api/partidos/:partido_id/arbitro           → Asignar árbitro (organizador del torneo)
 * POST /api/partidos/:partido_id/nominas           → Enviar alineación unificada (capitán)
 * PUT  /api/partidos/:partido_id/nominas/validar   → Validar/rechazar alineación (árbitro)
 * GET  /api/partidos/:partido_id/nominas           → Listar nóminas del partido
 * GET  /api/partidos/mis-arbitrajes                → Partidos asignados al árbitro autenticado
 * GET  /api/partidos/:id/marcador                  → Marcador en vivo del partido
 * POST /api/partidos/:id/eventos/set               → Registrar resultado de un set (árbitro)
 * POST /api/partidos/:id/eventos/punto             → Registrar punto (árbitro)
 * POST /api/partidos/:id/eventos/deshacer          → Deshacer último punto (árbitro)
 * POST /api/partidos/:id/eventos/cambio            → Registrar cambio (árbitro)
 * POST /api/partidos/:id/eventos/sancion            → Registrar tarjeta (árbitro)
 * PATCH /api/partidos/:id/eventos/:evento_id/detalle → Detallar punto (tipo acción/error)
 */

const router = express.Router();

router.get('/mis-arbitrajes', verifyToken, getMisArbitrajes);
router.get('/:partido_id/asignacion-arbitro', verifyToken, getAsignacionArbitroDetalle);
router.get('/:id/marcador', verifyToken, getMarcadorPartido);
router.get('/:id/mapas-calor', verifyToken, getMapasCalorPartido);
router.put('/:id/equipo-que-saca-inicial', verifyToken, definirEquipoQueSacaInicial);
router.put('/:id/equipo-que-saca-set', verifyToken, definirEquipoQueSacaSet);
router.post('/:id/iniciar', verifyToken, iniciarPartido);
router.post('/:id/eventos/set', verifyToken, registrarSetPartido);
router.post('/:id/eventos/punto', verifyToken, registrarPuntoPartido);
router.post('/:id/eventos/deshacer', verifyToken, deshacerUltimoPuntoPartido);
router.post('/:id/eventos/cambio', verifyToken, registrarCambioPartido);
router.post('/:id/eventos/sancion', verifyToken, registrarSancionPartido);
router.patch('/:id/eventos/:evento_id/detalle', verifyToken, actualizarDetalleEventoPartido);
router.put('/:partido_id/arbitro', verifyToken, asignarArbitroPartido);
router.put('/:partido_id/arbitro/confirmar', verifyToken, confirmarAsignacionArbitro);
router.post('/:partido_id/nominas', verifyToken, proponerNomina);
router.put('/:partido_id/nominas/validar', verifyToken, validarNomina);
router.get('/:partido_id/nominas', verifyToken, listarNominasPartido);

export default router;
