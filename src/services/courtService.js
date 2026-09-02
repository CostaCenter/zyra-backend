import { Canchas, Complejos, Sports, CanchaHorariosPrecios, sequelize } from '../db/db.js';

/**
 * Service de Canchas - Zyra
 * Lógica de negocio para la gestión de canchas deportivas
 */

/**
 * Crear una nueva cancha
 * @param {Object} data - Datos de la cancha
 * @returns {Promise<Object>} - Cancha creada
 */
export const createCourt = async (data) => {
  try {
    const {
      complejo_id,
      nombre,
      tipo_deporte,
      sport_id,
      precio_hora,
      state = 'DISPONIBLE',
      photo
    } = data;

    // Verificar que el complejo existe
    const complejo = await Complejos.findByPk(complejo_id);
    if (!complejo) {
      throw new Error('Complejo no encontrado');
    }

    // Verificar que el sport existe si se proporciona sport_id
    if (sport_id) {
      const sport = await Sports.findByPk(sport_id);
      if (!sport) {
        throw new Error('Deporte no encontrado');
      }
    }

    // Crear la cancha
    const newCourt = await Canchas.create({
      complejo_id,
      nombre,
      tipo_deporte,
      sport_id,
      precio_hora,
      state,
      photo
    });

    // Retornar la cancha con sus relaciones
    const courtWithRelations = await Canchas.findByPk(newCourt.id, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'ubicacion']
        },
        {
          model: Sports,
          as: 'sport',
          attributes: ['id', 'name']
        }
      ]
    });

    return courtWithRelations;

  } catch (error) {
    console.error('Error en courtService.createCourt:', error);
    throw error;
  }
};

/**
 * Obtener todas las canchas de un complejo
 * Excluye las canchas con estado "ELIMINADA" (soft delete)
 * @param {number} complexId - ID del complejo
 * @returns {Promise<Array>} - Lista de canchas
 */
export const getCourtsByComplex = async (complexId) => {
  try {
    // Verificar que el complejo existe
    const complejo = await Complejos.findByPk(complexId);
    if (!complejo) {
      throw new Error('Complejo no encontrado');
    }

    // Obtener todas las canchas del complejo (excluyendo eliminadas)
    const courts = await Canchas.findAll({
      where: { 
        complejo_id: complexId,
        state: {
          [sequelize.Sequelize.Op.ne]: 'ELIMINADA' // Excluir canchas eliminadas
        }
      },
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'ubicacion']
        },
        {
          model: Sports,
          as: 'sport',
          attributes: ['id', 'name']
        }
      ],
      order: [['id', 'ASC']]
    });

    return courts;

  } catch (error) {
    console.error('Error en courtService.getCourtsByComplex:', error);
    throw error;
  }
};

/**
 * Obtener una cancha por ID
 * @param {number} courtId - ID de la cancha
 * @returns {Promise<Object>} - Cancha encontrada
 */
export const getCourtById = async (courtId) => {
  try {
    const court = await Canchas.findByPk(courtId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'ubicacion', 'dueño_id']
        },
        {
          model: Sports,
          as: 'sport',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    return court;

  } catch (error) {
    console.error('Error en courtService.getCourtById:', error);
    throw error;
  }
};

/**
 * Actualizar una cancha
 * @param {number} courtId - ID de la cancha
 * @param {number} ownerId - ID del dueño del complejo
 * @param {Object} updateData - Datos a actualizar
 * @returns {Promise<Object>} - Cancha actualizada
 */
export const updateCourt = async (courtId, ownerId, updateData) => {
  try {
    // Obtener la cancha con su complejo
    const court = await Canchas.findByPk(courtId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'dueño_id']
        }
      ]
    });

    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    // Verificar que el usuario es el dueño del complejo
    if (court.complejo.dueño_id !== ownerId) {
      throw new Error('No tienes permiso para editar esta cancha');
    }

    // Si se actualiza el sport_id, verificar que existe
    if (updateData.sport_id) {
      const sport = await Sports.findByPk(updateData.sport_id);
      if (!sport) {
        throw new Error('Deporte no encontrado');
      }
    }

    // Actualizar la cancha
    await court.update(updateData);

    // Retornar la cancha actualizada con sus relaciones
    const updatedCourt = await Canchas.findByPk(courtId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'ubicacion']
        },
        {
          model: Sports,
          as: 'sport',
          attributes: ['id', 'name']
        }
      ]
    });

    return updatedCourt;

  } catch (error) {
    console.error('Error en courtService.updateCourt:', error);
    throw error;
  }
};

/**
 * Eliminar una cancha
 * @param {number} courtId - ID de la cancha
 * @param {number} ownerId - ID del dueño del complejo
 * @returns {Promise<void>}
 */
export const deleteCourt = async (courtId, ownerId) => {
  try {
    // Obtener la cancha con su complejo
    const court = await Canchas.findByPk(courtId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'dueño_id']
        }
      ]
    });

    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    // Verificar que el usuario es el dueño del complejo
    if (court.complejo.dueño_id !== ownerId) {
      throw new Error('No tienes permiso para eliminar esta cancha');
    }

    // Eliminar la cancha
    await court.destroy();

  } catch (error) {
    console.error('Error en courtService.deleteCourt:', error);
    throw error;
  }
};

/**
 * Actualizar el estado de una cancha (Soft Delete incluido)
 * @param {number} courtId - ID de la cancha
 * @param {number} ownerId - ID del dueño del complejo
 * @param {string} estado - Nuevo estado de la cancha
 * @returns {Promise<Object>} - Cancha actualizada
 */
export const updateCourtState = async (courtId, ownerId, estado) => {
  try {
    // Obtener la cancha con su complejo
    const court = await Canchas.findByPk(courtId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'dueño_id']
        }
      ]
    });

    if (!court) {
      throw new Error('Cancha no encontrada');
    }

    // Verificar que el usuario es el dueño del complejo
    if (court.complejo.dueño_id !== ownerId) {
      throw new Error('No tienes permiso para editar esta cancha');
    }

    // Actualizar el estado
    await court.update({ state: estado });

    // Retornar la cancha actualizada con sus relaciones
    const updatedCourt = await Canchas.findByPk(courtId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'ubicacion']
        },
        {
          model: Sports,
          as: 'sport',
          attributes: ['id', 'name']
        }
      ]
    });

    return updatedCourt;

  } catch (error) {
    console.error('Error en courtService.updateCourtState:', error);
    throw error;
  }
};

/**
 * Clonar una cancha con toda su configuración de horarios y precios
 * @param {number} courtId - ID de la cancha original
 * @param {number} ownerId - ID del dueño del complejo
 * @returns {Promise<Object>} - Cancha clonada
 */
export const cloneCourt = async (courtId, ownerId) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Obtener la cancha original con su complejo
    const originalCourt = await Canchas.findByPk(courtId, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'dueño_id']
        }
      ]
    });

    if (!originalCourt) {
      throw new Error('Cancha no encontrada');
    }

    // Verificar que el usuario es el dueño del complejo
    if (originalCourt.complejo.dueño_id !== ownerId) {
      throw new Error('No tienes permiso para clonar esta cancha');
    }

    // Crear la nueva cancha clonada
    const newCourt = await Canchas.create({
      complejo_id: originalCourt.complejo_id,
      nombre: `${originalCourt.nombre} Copia`,
      tipo_deporte: originalCourt.tipo_deporte,
      sport_id: originalCourt.sport_id,
      precio_hora: originalCourt.precio_hora,
      state: 'NO DISPONIBLE', // Estado inicial para cancha clonada
      photo: originalCourt.photo
    }, { transaction });

    // Obtener todos los horarios y precios de la cancha original
    const originalPrices = await CanchaHorariosPrecios.findAll({
      where: { cancha_id: courtId }
    });

    // Clonar los horarios y precios para la nueva cancha
    if (originalPrices.length > 0) {
      const clonedPrices = originalPrices.map(price => ({
        cancha_id: newCourt.id,
        tipo_dia: price.tipo_dia,
        hora_inicio: price.hora_inicio,
        hora_fin: price.hora_fin,
        precio_hora: price.precio_hora
      }));

      await CanchaHorariosPrecios.bulkCreate(clonedPrices, { transaction });
    }

    // Confirmar la transacción
    await transaction.commit();

    // Retornar la cancha clonada con sus relaciones
    const clonedCourt = await Canchas.findByPk(newCourt.id, {
      include: [
        {
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'ubicacion']
        },
        {
          model: Sports,
          as: 'sport',
          attributes: ['id', 'name']
        },
        {
          model: CanchaHorariosPrecios,
          as: 'horariosPrecios'
        }
      ]
    });

    return clonedCourt;

  } catch (error) {
    // Revertir la transacción en caso de error
    await transaction.rollback();
    console.error('Error en courtService.cloneCourt:', error);
    throw error;
  }
};
