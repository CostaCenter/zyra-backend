import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  create,
  getByComplex,
  getById,
  update,
  updateName,
  updateState,
  clone,
  remove
} from '../controllers/courtController.js';
import {
  setPrices,
  getPrices,
  updatePrice,
  deletePrice,
  deleteAllPrices,
  getPreciosBloques,
  setPreciosBloques
} from '../controllers/courtPriceController.js';

/**
 * Rutas de Canchas - Zyra
 * /api/courts
 * 
 * === CRUD de Canchas ===
 * POST   /api/courts - Crear cancha (protegido)
 * GET    /api/courts/complex/:complexId - Obtener canchas de un complejo (público)
 * GET    /api/courts/:id - Obtener cancha por ID (público)
 * PUT    /api/courts/:id - Actualizar cancha (protegido)
 * PATCH  /api/courts/:id/nombre - Actualizar solo nombre de cancha (protegido)
 * PATCH  /api/courts/:id/estado - Actualizar solo estado de cancha (protegido)
 * POST   /api/courts/:id/clonar - Clonar cancha con toda su configuración (protegido)
 * DELETE /api/courts/:id - Eliminar cancha (protegido)
 * 
 * === Gestión de Precios Dinámicos (LEGACY - Por día individual) ===
 * POST   /api/courts/:id/precios - Configurar precios por franjas horarias (protegido)
 * GET    /api/courts/:id/precios - Obtener configuración de precios (público)
 * PUT    /api/courts/:id/precios/:precioId - Actualizar una franja específica (protegido)
 * DELETE /api/courts/:id/precios/:precioId - Eliminar una franja específica (protegido)
 * DELETE /api/courts/:id/precios - Eliminar todos los precios dinámicos (protegido)
 * 
 * === Gestión de Precios por BLOQUES (Sistema nuevo - Recomendado) ===
 * GET    /api/canchas/:id/precios - Obtener precios agrupados por bloques lógicos (público)
 * PUT    /api/canchas/:id/precios - Guardar configuración de bloques (protegido)
 */

const router = express.Router();

// ============================================================
// CRUD DE CANCHAS
// ============================================================

// Crear cancha (Protegido: solo dueños del complejo)
router.post('/', verifyToken, create);

// Obtener canchas de un complejo (Público)
router.get('/complex/:complexId', getByComplex);

// Obtener cancha por ID (Público)
router.get('/:id', getById);

// Actualizar cancha (Protegido: solo dueño del complejo)
router.put('/:id', verifyToken, update);

// Actualizar solo nombre de cancha (Protegido: solo dueño del complejo)
router.patch('/:id/nombre', verifyToken, updateName);

// Actualizar solo estado de cancha (Protegido: solo dueño del complejo)
router.patch('/:id/estado', verifyToken, updateState);

// Clonar cancha con toda su configuración (Protegido: solo dueño del complejo)
router.post('/:id/clonar', verifyToken, clone);

// Eliminar cancha (Protegido: solo dueño del complejo)
router.delete('/:id', verifyToken, remove);

// ============================================================
// GESTIÓN DE PRECIOS DINÁMICOS (LEGACY)
// ============================================================

// Configurar precios por franjas horarias (Protegido)
router.post('/:id/precios', verifyToken, setPrices);

// Obtener configuración de precios (Público)
router.get('/:id/precios', getPrices);

// Actualizar una franja de precio específica (Protegido)
router.put('/:id/precios/:precioId', verifyToken, updatePrice);

// Eliminar una franja de precio específica (Protegido)
router.delete('/:id/precios/:precioId', verifyToken, deletePrice);

// Eliminar todos los precios dinámicos (Protegido)
router.delete('/:id/precios', verifyToken, deleteAllPrices);

export default router;
