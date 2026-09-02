import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  crearReserva,
  getMisReservas,
  getReservasPorCancha,
  getReservasPorComplejo,
  getReservaById,
  moverReserva,
  registrarPagoTotal,
  cancelarReserva,
  getDisponibilidad,
  getHistorialCliente
} from '../controllers/reservaController.js';

/**
 * Rutas de Reservas - Zyra
 * /api/reservas
 *
 * === Consulta pública ===
 * GET  /api/reservas/disponibilidad/:canchaId?fecha=YYYY-MM-DD
 *      → Horarios ocupados/libres de una cancha (sin auth)
 *
 * === Cualquier usuario autenticado ===
 * POST  /api/reservas                        → Crear reserva (paga 50%)
 * GET   /api/reservas/mis-reservas           → Ver mis reservas
 * GET   /api/reservas/:id                    → Ver detalle de una reserva
 * PATCH /api/reservas/:id/cancelar           → Cancelar reserva
 *
 * === Solo dueño del complejo ===
 * GET   /api/reservas/cancha/:canchaId       → Ver todas las reservas de una cancha
 * GET   /api/reservas/complejo/:complejoId   → Ver todas las reservas de un complejo
 * PATCH /api/reservas/:id/mover             → Mover reserva a otra fecha/hora
 * PATCH /api/reservas/:id/pago-total        → Registrar pago total
 */

const router = express.Router();

// ============================================================
// CONSULTA PÚBLICA (sin auth)
// ============================================================

// Disponibilidad de una cancha en una fecha
router.get('/disponibilidad/:canchaId', getDisponibilidad);

// ============================================================
// RUTAS DE USUARIO AUTENTICADO
// ============================================================

// Crear reserva
router.post('/', verifyToken, crearReserva);

// Ver mis reservas (con filtros opcionales: ?estado=CONFIRMADA&fecha_desde=2026-05-01)
router.get('/mis-reservas', verifyToken, getMisReservas);

// ============================================================
// RUTAS DE DUEÑO DEL COMPLEJO
// ============================================================

// Ver reservas de un complejo completo
router.get('/complejo/:complejoId', verifyToken, getReservasPorComplejo);

// Ver reservas de una cancha específica
router.get('/cancha/:canchaId', verifyToken, getReservasPorCancha);

// Obtener historial de un cliente por teléfono
router.get('/historial-cliente/:telefono', verifyToken, getHistorialCliente);

// ============================================================
// RUTAS COMPARTIDAS (usuario o dueño)
// ============================================================

// Ver detalle de una reserva
router.get('/:id', verifyToken, getReservaById);

// Mover reserva (solo dueño)
router.patch('/:id/mover', verifyToken, moverReserva);

// Registrar pago total (solo dueño)
router.patch('/:id/pago-total', verifyToken, registrarPagoTotal);

// Cancelar reserva (usuario o dueño)
router.patch('/:id/cancelar', verifyToken, cancelarReserva);

export default router;
