import { ConfiguracionHorariosFavoritos, Complejos, Canchas } from '../db/db.js';

/**
 * Service de Configuraciones de Horarios Favoritos - Zyra
 * Lógica de negocio para la gestión de plantillas de precios y horarios
 */

const verificarPermisoComplejo = async (complejoId, userId) => {
  const complejo = await Complejos.findByPk(complejoId);
  if (!complejo) {
    throw new Error('Complejo no encontrado');
  }
  if (complejo.dueño_id !== userId) {
    throw new Error('No tienes permiso para gestionar configuraciones en este complejo');
  }
  return complejo;
};

const verificarCanchaDelComplejo = async (canchaId, complejoId) => {
  const cancha = await Canchas.findByPk(canchaId);
  if (!cancha) {
    throw new Error('Cancha no encontrada');
  }
  if (Number(cancha.complejo_id) !== Number(complejoId)) {
    throw new Error('La cancha no pertenece al complejo indicado');
  }
  return cancha;
};

/**
 * Crear una nueva configuración favorita
 * @param {Object} data - Datos de la configuración
 * @returns {Promise<Object>} - Configuración creada
 */
export const createConfiguracionFavorita = async (data) => {
  try {
    const { complejo_id, cancha_id, nombre_plantilla, configuracion, userId } = data;

    const complejoId = parseInt(complejo_id, 10);
    const canchaId = parseInt(cancha_id, 10);

    if (Number.isNaN(complejoId) || Number.isNaN(canchaId)) {
      throw new Error('complejo_id y cancha_id deben ser números válidos');
    }

    await verificarPermisoComplejo(complejoId, userId);
    await verificarCanchaDelComplejo(canchaId, complejoId);

    const existente = await ConfiguracionHorariosFavoritos.findOne({
      where: { cancha_id: canchaId }
    });

    if (existente) {
      throw new Error('Esta cancha ya tiene una configuración favorita guardada');
    }

    const newConfig = await ConfiguracionHorariosFavoritos.create({
      complejo_id: complejoId,
      cancha_id: canchaId,
      nombre_plantilla,
      configuracion
    });

    return newConfig;

  } catch (error) {
    console.error('Error en configuracionFavoritosService.createConfiguracionFavorita:', error);
    throw error;
  }
};

/**
 * Obtener todas las configuraciones favoritas de un complejo
 * @param {number} complejoId - ID del complejo
 * @param {number} userId - ID del usuario
 * @returns {Promise<Array>} - Lista de configuraciones
 */
export const getConfiguracionesByComplejo = async (complejoId, userId) => {
  try {
    await verificarPermisoComplejo(complejoId, userId);

    const configuraciones = await ConfiguracionHorariosFavoritos.findAll({
      where: { complejo_id: complejoId },
      attributes: ['id', 'complejo_id', 'cancha_id', 'nombre_plantilla', 'configuracion', 'created_at', 'updated_at'],
      order: [['created_at', 'DESC']]
    });

    return configuraciones;

  } catch (error) {
    console.error('Error en configuracionFavoritosService.getConfiguracionesByComplejo:', error);
    throw error;
  }
};

/**
 * Obtener la configuración favorita de una cancha
 * @param {number} canchaId - ID de la cancha
 * @param {number} userId - ID del usuario
 * @returns {Promise<Object|null>} - Configuración encontrada o null
 */
export const getConfiguracionByCancha = async (canchaId, userId) => {
  try {
    const cancha = await Canchas.findByPk(canchaId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'dueño_id']
        }
      ]
    });

    if (!cancha) {
      throw new Error('Cancha no encontrada');
    }

    if (!cancha.complejo || cancha.complejo.dueño_id !== userId) {
      throw new Error('No tienes permiso para ver esta configuración');
    }

    const configuracion = await ConfiguracionHorariosFavoritos.findOne({
      where: { cancha_id: canchaId },
      attributes: ['id', 'complejo_id', 'cancha_id', 'nombre_plantilla', 'configuracion', 'created_at', 'updated_at']
    });

    return configuracion;

  } catch (error) {
    console.error('Error en configuracionFavoritosService.getConfiguracionByCancha:', error);
    throw error;
  }
};

/**
 * Obtener una configuración favorita por ID
 * @param {number} configId - ID de la configuración
 * @param {number} userId - ID del usuario
 * @returns {Promise<Object>} - Configuración encontrada
 */
export const getConfiguracionById = async (configId, userId) => {
  try {
    const configuracion = await ConfiguracionHorariosFavoritos.findByPk(configId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'dueño_id']
        }
      ]
    });

    if (!configuracion) {
      throw new Error('Configuración no encontrada');
    }

    if (configuracion.complejo.dueño_id !== userId) {
      throw new Error('No tienes permiso para ver esta configuración');
    }

    return configuracion;

  } catch (error) {
    console.error('Error en configuracionFavoritosService.getConfiguracionById:', error);
    throw error;
  }
};

/**
 * Actualizar una configuración favorita
 * @param {number} configId - ID de la configuración
 * @param {number} userId - ID del usuario
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>} - Configuración actualizada
 */
export const updateConfiguracion = async (configId, userId, updateData) => {
  try {
    const configuracion = await ConfiguracionHorariosFavoritos.findByPk(configId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'dueño_id']
        }
      ]
    });

    if (!configuracion) {
      throw new Error('Configuración no encontrada');
    }

    if (configuracion.complejo.dueño_id !== userId) {
      throw new Error('No tienes permiso para editar esta configuración');
    }

    await configuracion.update(updateData);

    const updatedConfig = await ConfiguracionHorariosFavoritos.findByPk(configId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre']
        }
      ]
    });

    return updatedConfig;

  } catch (error) {
    console.error('Error en configuracionFavoritosService.updateConfiguracion:', error);
    throw error;
  }
};

/**
 * Eliminar una configuración favorita
 * @param {number} configId - ID de la configuración
 * @param {number} userId - ID del usuario
 * @returns {Promise<void>}
 */
export const deleteConfiguracion = async (configId, userId) => {
  try {
    const configuracion = await ConfiguracionHorariosFavoritos.findByPk(configId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'dueño_id']
        }
      ]
    });

    if (!configuracion) {
      throw new Error('Configuración no encontrada');
    }

    if (configuracion.complejo.dueño_id !== userId) {
      throw new Error('No tienes permiso para eliminar esta configuración');
    }

    await configuracion.destroy();

  } catch (error) {
    console.error('Error en configuracionFavoritosService.deleteConfiguracion:', error);
    throw error;
  }
};
