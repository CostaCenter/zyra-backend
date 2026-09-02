import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import * as complexController from '../controllers/complexController.js';
import * as scheduleController from '../controllers/complexScheduleController.js';
import * as exceptionController from '../controllers/calendarExceptionController.js';

const router = express.Router();

/**
 * Rutas de Complejos - Zyra
 * 
 * === CRUD de Complejos ===
 * POST   /api/complexes - Crear complejo (protegido)
 * GET    /api/complexes/my-complexes - Obtener complejos del usuario autenticado (protegido)
 * GET    /api/complexes - Obtener todos los complejos (público)
 * GET    /api/complexes/:id - Obtener complejo por ID con canchas y horarios (público)
 * PUT    /api/complexes/:id - Actualizar complejo (protegido - solo dueño)
 * DELETE /api/complexes/:id - Eliminar complejo (protegido - solo dueño)
 * 
 * === Gestión de Horarios ===
 * POST   /api/complexes/:id/horarios - Configurar horarios personalizados (protegido - solo dueño)
 * POST   /api/complexes/:id/horarios/estandar - Configurar horario estándar L-V/S/D (protegido - solo dueño)
 * GET    /api/complexes/:id/horarios - Obtener horarios del complejo (público)
 * PATCH  /api/complexes/:id/horarios/:dia - Marcar día como cerrado/abierto (protegido - solo dueño)
 * DELETE /api/complexes/:id/horarios - Eliminar todos los horarios (protegido - solo dueño)
 * 
 * === Gestión de Excepciones de Calendario (Festivos, Cierres) ===
 * POST   /api/complexes/:id/excepciones - Agregar una excepción (protegido - solo dueño)
 * POST   /api/complexes/:id/excepciones/bulk - Agregar múltiples excepciones (protegido - solo dueño)
 * GET    /api/complexes/:id/excepciones - Obtener todas las excepciones (público)
 * GET    /api/complexes/:id/excepciones/:fecha - Obtener excepción por fecha (público)
 * PUT    /api/complexes/:id/excepciones/:fecha - Actualizar excepción (protegido - solo dueño)
 * DELETE /api/complexes/:id/excepciones/:fecha - Eliminar excepción (protegido - solo dueño)
 */

// ============================================================
// CRUD DE COMPLEJOS
// ============================================================

// Crear un nuevo complejo (requiere autenticación)
router.post('/', verifyToken, complexController.create);

// Obtener complejos del usuario autenticado (Jorge ve sus complejos)
router.get('/my-complexes', verifyToken, complexController.getAllByOwner);

// Obtener todos los complejos (público)
router.get('/', complexController.getAll);

// Obtener complejo por ID (público)
router.get('/:id', complexController.getById);

// Actualizar complejo (solo el dueño puede editar)
router.put('/:id', verifyToken, complexController.update);

// Eliminar complejo (solo el dueño puede eliminar)
router.delete('/:id', verifyToken, complexController.remove);

// ============================================================
// GESTIÓN DE HORARIOS DE COMPLEJOS
// ============================================================

// Configurar horario estándar (debe ir antes de la ruta genérica)
router.post('/:id/horarios/estandar', verifyToken, scheduleController.setStandardSchedule);

// Configurar horarios personalizados
router.post('/:id/horarios', verifyToken, scheduleController.setSchedules);

// Obtener horarios del complejo (público)
router.get('/:id/horarios', scheduleController.getSchedules);

// Actualizar estado de un día específico (marcar como cerrado/abierto)
router.patch('/:id/horarios/:dia', verifyToken, scheduleController.updateDayStatus);

// Eliminar todos los horarios
router.delete('/:id/horarios', verifyToken, scheduleController.deleteSchedules);

// ============================================================
// GESTIÓN DE EXCEPCIONES DE CALENDARIO (Festivos, Cierres)
// ============================================================

// Agregar múltiples excepciones (debe ir antes de la ruta genérica)
router.post('/:id/excepciones/bulk', verifyToken, exceptionController.addBulkExceptions);

// Agregar una excepción
router.post('/:id/excepciones', verifyToken, exceptionController.addException);

// Obtener todas las excepciones del complejo
router.get('/:id/excepciones', exceptionController.getExceptions);

// Obtener excepción por fecha específica
router.get('/:id/excepciones/:fecha', exceptionController.getExceptionByDate);

// Actualizar una excepción
router.put('/:id/excepciones/:fecha', verifyToken, exceptionController.updateException);

// Eliminar una excepción
router.delete('/:id/excepciones/:fecha', verifyToken, exceptionController.deleteException);

export default router;
