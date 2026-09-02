import {
  createConfiguracionFavorita,
  getConfiguracionesByComplejo,
  getConfiguracionByCancha,
  getConfiguracionById,
  updateConfiguracion,
  deleteConfiguracion
} from '../services/configuracionFavoritosService.js';

/**
 * Controller de Configuraciones de Horarios Favoritos - Zyra
 * Maneja las peticiones HTTP para CRUD de plantillas de precios y horarios
 */

/**
 * POST /api/precios/favoritos
 * Crear una nueva configuración favorita
 */
export const create = async (req, res) => {
  try {
    const { complejo_id, cancha_id, nombre_plantilla, configuracion } = req.body;
    const userId = req.user.id;

    if (!complejo_id || !cancha_id || !nombre_plantilla || !configuracion) {
      return res.status(400).json({
        success: false,
        message: 'El complejo_id, cancha_id, nombre_plantilla y configuracion son obligatorios'
      });
    }

    // Validar que la configuración tenga la estructura correcta
    if (!configuracion.bloques || !Array.isArray(configuracion.bloques)) {
      return res.status(400).json({
        success: false,
        message: 'La configuración debe contener un array de bloques'
      });
    }

    const newConfig = await createConfiguracionFavorita({
      complejo_id: parseInt(complejo_id, 10),
      cancha_id: parseInt(cancha_id, 10),
      nombre_plantilla,
      configuracion,
      userId
    });

    res.status(201).json({
      success: true,
      message: 'Configuración favorita creada exitosamente',
      data: newConfig
    });

  } catch (error) {
    console.error('Error al crear configuración favorita:', error);

    if (error.message === 'Complejo no encontrado') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para crear configuraciones en este complejo' ||
        error.message === 'No tienes permiso para gestionar configuraciones en este complejo') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Cancha no encontrada' ||
        error.message === 'La cancha no pertenece al complejo indicado' ||
        error.message === 'Esta cancha ya tiene una configuración favorita guardada' ||
        error.message === 'complejo_id y cancha_id deben ser números válidos') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al crear configuración favorita',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/precios/favoritos/complejo/:complejoId
 * Obtener todas las configuraciones favoritas de un complejo
 */
export const getByComplejo = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.complejoId);
    const userId = req.user.id;

    if (isNaN(complejoId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de complejo inválido'
      });
    }

    const configuraciones = await getConfiguracionesByComplejo(complejoId, userId);

    res.status(200).json({
      success: true,
      message: 'Configuraciones favoritas del complejo',
      data: configuraciones,
      count: configuraciones.length
    });

  } catch (error) {
    console.error('Error al obtener configuraciones favoritas:', error);

    if (error.message === 'Complejo no encontrado') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para ver estas configuraciones' ||
        error.message === 'No tienes permiso para gestionar configuraciones en este complejo') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al obtener configuraciones favoritas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/precios/favoritos/cancha/:canchaId
 * Obtener la configuración favorita de una cancha
 */
export const getByCancha = async (req, res) => {
  try {
    const canchaId = parseInt(req.params.canchaId);
    const userId = req.user.id;

    if (isNaN(canchaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    const configuracion = await getConfiguracionByCancha(canchaId, userId);

    res.status(200).json({
      success: true,
      message: configuracion
        ? 'Configuración favorita de la cancha'
        : 'La cancha no tiene configuración favorita',
      data: configuracion
    });

  } catch (error) {
    console.error('Error al obtener configuración favorita de cancha:', error);

    if (error.message === 'Cancha no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para ver esta configuración') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración favorita de la cancha',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/precios/favoritos/:id
 * Obtener una configuración favorita por ID
 */
export const getById = async (req, res) => {
  try {
    const configId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(configId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de configuración inválido'
      });
    }

    const configuracion = await getConfiguracionById(configId, userId);

    res.status(200).json({
      success: true,
      message: 'Configuración favorita encontrada',
      data: configuracion
    });

  } catch (error) {
    console.error('Error al obtener configuración favorita:', error);

    if (error.message === 'Configuración no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para ver esta configuración') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración favorita',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/precios/favoritos/:id
 * Actualizar una configuración favorita
 */
export const update = async (req, res) => {
  try {
    const configId = parseInt(req.params.id);
    const userId = req.user.id;
    const { nombre_plantilla, configuracion } = req.body;

    if (isNaN(configId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de configuración inválido'
      });
    }

    const updateData = {};
    if (nombre_plantilla !== undefined) updateData.nombre_plantilla = nombre_plantilla;
    if (configuracion !== undefined) {
      // Validar estructura
      if (!configuracion.bloques || !Array.isArray(configuracion.bloques)) {
        return res.status(400).json({
          success: false,
          message: 'La configuración debe contener un array de bloques'
        });
      }
      updateData.configuracion = configuracion;
    }

    const updatedConfig = await updateConfiguracion(configId, userId, updateData);

    res.status(200).json({
      success: true,
      message: 'Configuración favorita actualizada exitosamente',
      data: updatedConfig
    });

  } catch (error) {
    console.error('Error al actualizar configuración favorita:', error);

    if (error.message === 'Configuración no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para editar esta configuración') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración favorita',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE /api/precios/favoritos/:id
 * Eliminar una configuración favorita
 */
export const remove = async (req, res) => {
  try {
    const configId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(configId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de configuración inválido'
      });
    }

    await deleteConfiguracion(configId, userId);

    res.status(200).json({
      success: true,
      message: 'Configuración favorita eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar configuración favorita:', error);

    if (error.message === 'Configuración no encontrada') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No tienes permiso para eliminar esta configuración') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error al eliminar configuración favorita',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
