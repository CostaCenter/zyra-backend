import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import {
  getPreciosBloques,
  setPreciosBloques
} from '../controllers/courtPriceController.js';

/**
 * Rutas Independientes para Precios de Canchas - Sistema de Bloques
 * /api/canchas/:id/precios
 * 
 * Este es el endpoint INDEPENDIENTE para la sección de "Precios" del Dashboard.
 * Utiliza el sistema de agrupación por BLOQUES LÓGICOS de días.
 * 
 * === Endpoints Disponibles ===
 * GET  /api/canchas/:id/precios - Obtener precios agrupados por bloques (público)
 * PUT  /api/canchas/:id/precios - Guardar configuración completa de bloques (protegido)
 * 
 * === Formato de Bloques ===
 * Un bloque agrupa varios días que comparten las mismas franjas horarias y precios.
 * 
 * Ejemplo de respuesta GET:
 * {
 *   "cancha_id": 1,
 *   "bloques": [
 *     {
 *       "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
 *       "horarios": [
 *         { "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 50000 },
 *         { "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 80000 }
 *       ]
 *     },
 *     {
 *       "dias": ["Sá", "Do", "Fes"],
 *       "horarios": [
 *         { "hora_inicio": "09:00", "hora_fin": "22:00", "precio_hora": 90000 }
 *       ]
 *     }
 *   ]
 * }
 * 
 * El mismo formato se utiliza para el PUT (guardar).
 */

const router = express.Router();

// ============================================================
// SISTEMA DE PRECIOS POR BLOQUES (Interfaz Principal)
// ============================================================

/**
 * GET /api/canchas/:id/precios
 * Obtener precios agrupados en bloques lógicos para pintar la interfaz.
 * 
 * - Consulta todos los registros planos de la BD
 * - Los agrupa en bloques (días con las mismas franjas y precios)
 * - Retorna formato optimizado para el frontend
 * - Acceso: Público
 */
router.get('/:id/precios', getPreciosBloques);

/**
 * PUT /api/canchas/:id/precios
 * Guardar configuración completa de precios por bloques.
 * 
 * - Recibe el array de bloques del frontend
 * - Elimina toda la configuración anterior
 * - Aplana los bloques y crea registros individuales en la BD
 * - Todo en una transacción para garantizar consistencia
 * - Acceso: Solo dueño del complejo (protegido)
 * 
 * Body esperado:
 * {
 *   "bloques": [
 *     {
 *       "dias": ["Lu", "Ma", "Mi"],
 *       "horarios": [
 *         { "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 50000 }
 *       ]
 *     }
 *   ]
 * }
 */
router.put('/:id/precios', verifyToken, setPreciosBloques);

export default router;
