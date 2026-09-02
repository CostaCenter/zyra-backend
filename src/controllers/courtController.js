import {
  createCourt,
  getCourtsByComplex,
  getCourtById,
  updateCourt,
  deleteCourt,
  updateCourtState,
  cloneCourt
} from '../services/courtService.js';
import { Complejos } from '../db/db.js';

/**
 * Controller de Canchas - Zyra
 * Maneja las peticiones HTTP para CRUD de canchas deportivas
 */

/**
 * POST /api/courts
 * Crear una nueva cancha (requiere autenticación)
 * Solo el dueño del complejo puede crear canchas
 */
export const create = async (req, res) => {
  try {
    const {
      complejo_id,
      nombre,
      tipo_deporte,
      sport_id,
      precio_hora,
      state,
      photo
    } = req.body;

    const userId = req.user.id; // Extraído del middleware verifyToken

    // Validaciones básicas
    if (!complejo_id) {
      return res.status(400).json({
        success: false,
        message: 'El ID del complejo es obligatorio'
      });
    }

    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la cancha es obligatorio'
      });
    }

    // SEGURIDAD: Verificar que el complejo pertenece al usuario autenticado
    const complejo = await Complejos.findByPk(complejo_id);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    if (complejo.dueño_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para crear canchas en este complejo. Solo el dueño puede hacerlo.'
      });
    }

    // Crear la cancha
    const newCourt = await createCourt({
      complejo_id,
      nombre,
      tipo_deporte,
      sport_id,
      precio_hora,
      state,
      photo
    });

    res.status(201).json({
      success: true,
      message: 'Cancha creada exitosamente',
      data: newCourt
    });

  } catch (error) {
    console.error('Error al crear cancha:', error);

    if (error.message === 'Complejo no encontrado') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Deporte no encontrado') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear cancha',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/courts/complex/:complexId
 * Obtener todas las canchas de un complejo específico
 * Ruta pública (no requiere autenticación)
 */
export const getByComplex = async (req, res) => {
  try {
    const complexId = parseInt(req.params.complexId);

    if (isNaN(complexId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de complejo inválido'
      });
    }

    const courts = await getCourtsByComplex(complexId);

    res.status(200).json({
      success: true,
      message: 'Canchas del complejo',
      data: courts,
      count: courts.length
    });

  } catch (error) {
    console.error('Error al obtener canchas del complejo:', error);

    if (error.message === 'Complejo no encontrado') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al obtener canchas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/courts/:id
 * Obtener una cancha por ID
 * Ruta pública
 */
export const getById = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id);

    if (isNaN(courtId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    const court = await getCourtById(courtId);

    res.status(200).json({
      success: true,
      message: 'Cancha encontrada',
      data: court
    });

  } catch (error) {
    console.error('Error al obtener cancha:', error);

    if (error.message === 'Cancha no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al obtener cancha',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/courts/:id
 * Actualizar una cancha (solo el dueño del complejo)
 */
export const update = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id);
    const userId = req.user.id; // Del middleware verifyToken
    
    if (isNaN(courtId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    const {
      nombre,
      tipo_deporte,
      sport_id,
      precio_hora,
      state,
      photo
    } = req.body;

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (tipo_deporte !== undefined) updateData.tipo_deporte = tipo_deporte;
    if (sport_id !== undefined) updateData.sport_id = sport_id;
    if (precio_hora !== undefined) updateData.precio_hora = precio_hora;
    if (state !== undefined) updateData.state = state;
    if (photo !== undefined) updateData.photo = photo;

    const updatedCourt = await updateCourt(courtId, userId, updateData);

    res.status(200).json({
      success: true,
      message: 'Cancha actualizada exitosamente',
      data: updatedCourt
    });

  } catch (error) {
    console.error('Error al actualizar cancha:', error);

    if (error.message === 'Cancha no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para editar esta cancha') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Deporte no encontrado') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al actualizar cancha',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PATCH /api/courts/:id/nombre
 * Actualizar el nombre de una cancha (solo el dueño del complejo)
 */
export const updateName = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id);
    const userId = req.user.id;
    const { nombre } = req.body;

    if (isNaN(courtId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la cancha es obligatorio'
      });
    }

    const updatedCourt = await updateCourt(courtId, userId, { nombre: nombre.trim() });

    res.status(200).json({
      success: true,
      message: 'Nombre de la cancha actualizado exitosamente',
      data: updatedCourt
    });

  } catch (error) {
    console.error('Error al actualizar nombre de cancha:', error);

    if (error.message === 'Cancha no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para editar esta cancha') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al actualizar nombre de cancha',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PATCH /api/courts/:id/estado
 * Actualizar el estado de una cancha (solo el dueño del complejo)
 * Estados permitidos: ACTIVA, NO DISPONIBLE, MANTENIMIENTO, ELIMINADA
 */
export const updateState = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id);
    const userId = req.user.id;
    const { estado } = req.body;

    if (isNaN(courtId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    const estadosPermitidos = ['ACTIVA', 'NO DISPONIBLE', 'DISPONIBLE', 'MANTENIMIENTO', 'ELIMINADA', 'FUERA DE SERVICIO'];
    if (!estado || !estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: `Estado inválido. Debe ser uno de: ${estadosPermitidos.join(', ')}`
      });
    }

    const updatedCourt = await updateCourtState(courtId, userId, estado);

    res.status(200).json({
      success: true,
      message: 'Estado de la cancha actualizado exitosamente',
      data: updatedCourt
    });

  } catch (error) {
    console.error('Error al actualizar estado de cancha:', error);

    if (error.message === 'Cancha no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para editar esta cancha') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado de cancha',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/courts/:id/clonar
 * Clonar una cancha con toda su configuración de horarios y precios
 * La cancha clonada se crea con estado "NO DISPONIBLE" y nombre "${original} Copia"
 */
export const clone = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(courtId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    const clonedCourt = await cloneCourt(courtId, userId);

    res.status(201).json({
      success: true,
      message: 'Cancha clonada exitosamente',
      data: clonedCourt
    });

  } catch (error) {
    console.error('Error al clonar cancha:', error);

    if (error.message === 'Cancha no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para clonar esta cancha') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al clonar cancha',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE /api/courts/:id
 * Eliminar una cancha (solo el dueño del complejo)
 */
export const remove = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id);
    const userId = req.user.id; // Del middleware verifyToken

    if (isNaN(courtId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    await deleteCourt(courtId, userId);

    res.status(200).json({
      success: true,
      message: 'Cancha eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar cancha:', error);

    if (error.message === 'Cancha no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para eliminar esta cancha') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al eliminar cancha',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
