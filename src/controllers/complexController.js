import {
  createComplex,
  getComplexesByOwner,
  getAllComplexes,
  getComplexById,
  updateComplex,
  deleteComplex
} from '../services/complexService.js';

/**
 * Controller de Complejos - Zyra
 * Maneja las peticiones HTTP para CRUD de complejos deportivos
 */

/**
 * POST /api/complexes
 * Crear un nuevo complejo (requiere autenticación)
 */
export const create = async (req, res) => {
  try {
    const { nombre, ubicacion, photo, wallpaper } = req.body;
    const dueño_id = req.user.id; // Extraído del middleware verifyToken

    // Validaciones básicas
    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del complejo es obligatorio'
      });
    }

    // Crear el complejo
    const newComplex = await createComplex({
      nombre,
      ubicacion,
      dueño_id,
      photo,
      wallpaper
    });

    res.status(201).json({
      success: true,
      message: 'Complejo creado exitosamente',
      data: newComplex
    });

  } catch (error) {
    console.error('Error al crear complejo:', error);

    if (error.message === 'El usuario dueño no existe') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear complejo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/complexes/my-complexes
 * Obtener todos los complejos del usuario autenticado (Jorge ve sus complejos)
 */
export const getAllByOwner = async (req, res) => {
  try {
    const ownerId = req.user.id; // Del middleware verifyToken

    const complexes = await getComplexesByOwner(ownerId);

    res.status(200).json({
      success: true,
      message: 'Complejos del usuario',
      data: complexes,
      count: complexes.length
    });

  } catch (error) {
    console.error('Error al obtener complejos del dueño:', error);

    res.status(500).json({
      success: false,
      message: 'Error al obtener complejos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/complexes
 * Obtener todos los complejos (público o con autenticación)
 */
export const getAll = async (req, res) => {
  try {
    const complexes = await getAllComplexes();

    res.status(200).json({
      success: true,
      message: 'Lista de complejos',
      data: complexes,
      count: complexes.length
    });

  } catch (error) {
    console.error('Error al obtener complejos:', error);

    res.status(500).json({
      success: false,
      message: 'Error al obtener complejos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/complexes/:id
 * Obtener un complejo por ID con información completa:
 * - Datos del complejo (nombre, ubicación, fotos)
 * - Información del dueño
 * - Lista de canchas con sus deportes
 * - Horarios de apertura del complejo
 */
export const getById = async (req, res) => {
  try {
    const complexId = req.params.id;

    const complex = await getComplexById(complexId);

    res.status(200).json({
      success: true,
      message: 'Complejo encontrado',
      data: complex
    });

  } catch (error) {
    console.error('Error al obtener complejo:', error);

    if (error.message === 'Complejo no encontrado') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al obtener complejo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/complexes/:id
 * Actualizar un complejo (solo el dueño)
 */
export const update = async (req, res) => {
  try {
    const complexId = req.params.id;
    const ownerId = req.user.id; // Del middleware verifyToken
    const { nombre, ubicacion, photo, wallpaper } = req.body;

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (ubicacion !== undefined) updateData.ubicacion = ubicacion;
    if (photo !== undefined) updateData.photo = photo;
    if (wallpaper !== undefined) updateData.wallpaper = wallpaper;

    const updatedComplex = await updateComplex(complexId, ownerId, updateData);

    res.status(200).json({
      success: true,
      message: 'Complejo actualizado exitosamente',
      data: updatedComplex
    });

  } catch (error) {
    console.error('Error al actualizar complejo:', error);

    if (error.message === 'Complejo no encontrado') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para editar este complejo') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al actualizar complejo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE /api/complexes/:id
 * Eliminar un complejo (solo el dueño)
 */
export const remove = async (req, res) => {
  try {
    const complexId = req.params.id;
    const ownerId = req.user.id; // Del middleware verifyToken

    await deleteComplex(complexId, ownerId);

    res.status(200).json({
      success: true,
      message: 'Complejo eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar complejo:', error);

    if (error.message === 'Complejo no encontrado') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para eliminar este complejo') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al eliminar complejo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
