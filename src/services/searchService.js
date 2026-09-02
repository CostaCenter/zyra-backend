import { Canchas, Complejos, Sports } from '../db/db.js';
import { Op } from 'sequelize';

/**
 * Service de Búsqueda - Zyra
 * Lógica de negocio para buscar canchas disponibles con filtros flexibles
 */

/**
 * Buscar canchas disponibles con filtros flexibles
 * @param {Object} filters - Filtros de búsqueda
 * @param {string} filters.q - Texto de búsqueda (nombre de cancha o complejo)
 * @param {string} filters.deporte - Nombre del deporte para filtrar
 * @param {number} filters.sport_id - ID del deporte para filtrar
 * @param {string} filters.fecha - Fecha para verificar disponibilidad (formato YYYY-MM-DD)
 * @param {string} filters.ubicacion - Ubicación del complejo
 * @param {string} filters.estado - Estado de la cancha (DISPONIBLE, OCUPADA, etc.)
 * @returns {Promise<Array>} - Lista de canchas que cumplen los criterios
 */
export const searchCourts = async (filters = {}) => {
  try {
    const {
      q,              // búsqueda de texto
      deporte,        // nombre del deporte
      sport_id,       // ID del deporte
      fecha,          // fecha de disponibilidad
      ubicacion,      // ubicación del complejo
      estado = 'DISPONIBLE'  // estado por defecto
    } = filters;

    // Construir condiciones WHERE para Canchas
    const whereCancha = {};
    const whereComplejo = {};
    const whereSport = {};

    // Filtro de estado de la cancha
    if (estado) {
      whereCancha.state = estado;
    }

    // Filtro por deporte (nombre)
    if (deporte) {
      whereSport.name = {
        [Op.iLike]: `%${deporte}%` // Búsqueda case-insensitive
      };
    }

    // Filtro por sport_id (más estricto)
    if (sport_id) {
      whereCancha.sport_id = parseInt(sport_id);
    }

    // Filtro por ubicación del complejo
    if (ubicacion) {
      whereComplejo.ubicacion = {
        [Op.iLike]: `%${ubicacion}%`
      };
    }

    // Búsqueda de texto en nombre de cancha o complejo
    const orConditions = [];
    if (q) {
      orConditions.push({
        nombre: {
          [Op.iLike]: `%${q}%`
        }
      });
    }

    // Si hay búsqueda de texto, también buscar en complejo
    if (q) {
      whereComplejo[Op.or] = [
        {
          nombre: {
            [Op.iLike]: `%${q}%`
          }
        }
      ];
    }

    // Aplicar búsqueda de texto si existe
    if (orConditions.length > 0) {
      whereCancha[Op.or] = orConditions;
    }

    // Configuración de la consulta
    const queryOptions = {
      where: whereCancha,
      include: [
        {
          model: Complejos,
          as: 'complejo',
          where: Object.keys(whereComplejo).length > 0 ? whereComplejo : undefined,
          attributes: ['id', 'nombre', 'ubicacion', 'photo', 'wallpaper'],
          required: true // INNER JOIN para asegurar que existe el complejo
        },
        {
          model: Sports,
          as: 'sport',
          where: Object.keys(whereSport).length > 0 ? whereSport : undefined,
          attributes: ['id', 'name', 'state'],
          required: deporte ? true : false // INNER JOIN solo si se filtra por deporte
        }
      ],
      order: [
        ['nombre', 'ASC'],
        [{ model: Complejos, as: 'complejo' }, 'nombre', 'ASC']
      ],
      distinct: true
    };

    // Ejecutar búsqueda
    const courts = await Canchas.findAll(queryOptions);

    // TODO: Si se proporciona fecha, aquí se puede agregar lógica adicional
    // para verificar disponibilidad en horarios/reservas
    // Por ahora, retornamos las canchas que cumplen los criterios básicos
    
    return courts;

  } catch (error) {
    console.error('Error en searchService.searchCourts:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de búsqueda
 * @param {Object} filters - Filtros aplicados
 * @returns {Promise<Object>} - Estadísticas de la búsqueda
 */
export const getSearchStats = async (filters = {}) => {
  try {
    const courts = await searchCourts(filters);

    // Agrupar por deporte
    const sportStats = courts.reduce((acc, court) => {
      const sportName = court.sport?.name || 'Sin deporte';
      if (!acc[sportName]) {
        acc[sportName] = 0;
      }
      acc[sportName]++;
      return acc;
    }, {});

    // Agrupar por ubicación
    const locationStats = courts.reduce((acc, court) => {
      const location = court.complejo?.ubicacion || 'Sin ubicación';
      if (!acc[location]) {
        acc[location] = 0;
      }
      acc[location]++;
      return acc;
    }, {});

    // Agrupar por complejo
    const complexStats = courts.reduce((acc, court) => {
      const complexName = court.complejo?.nombre || 'Sin complejo';
      if (!acc[complexName]) {
        acc[complexName] = 0;
      }
      acc[complexName]++;
      return acc;
    }, {});

    return {
      total: courts.length,
      byDeporte: sportStats,
      byUbicacion: locationStats,
      byComplejo: complexStats
    };

  } catch (error) {
    console.error('Error en searchService.getSearchStats:', error);
    throw error;
  }
};

/**
 * Búsqueda avanzada con paginación
 * @param {Object} filters - Filtros de búsqueda
 * @param {Object} pagination - Opciones de paginación
 * @param {number} pagination.page - Número de página (default: 1)
 * @param {number} pagination.limit - Límite por página (default: 10)
 * @returns {Promise<Object>} - Resultado paginado
 */
export const searchCourtsWithPagination = async (filters = {}, pagination = {}) => {
  try {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    const {
      q,
      deporte,
      sport_id,
      fecha,
      ubicacion,
      estado = 'DISPONIBLE'
    } = filters;

    // Construir condiciones WHERE
    const whereCancha = {};
    const whereComplejo = {};
    const whereSport = {};

    if (estado) {
      whereCancha.state = estado;
    }

    if (deporte) {
      whereSport.name = {
        [Op.iLike]: `%${deporte}%`
      };
    }

    if (sport_id) {
      whereCancha.sport_id = parseInt(sport_id);
    }

    if (ubicacion) {
      whereComplejo.ubicacion = {
        [Op.iLike]: `%${ubicacion}%`
      };
    }

    const orConditions = [];
    if (q) {
      orConditions.push({
        nombre: {
          [Op.iLike]: `%${q}%`
        }
      });
    }

    if (q) {
      whereComplejo[Op.or] = [
        {
          nombre: {
            [Op.iLike]: `%${q}%`
          }
        }
      ];
    }

    if (orConditions.length > 0) {
      whereCancha[Op.or] = orConditions;
    }

    // Consulta con paginación
    const { count, rows } = await Canchas.findAndCountAll({
      where: whereCancha,
      include: [
        {
          model: Complejos,
          as: 'complejo',
          where: Object.keys(whereComplejo).length > 0 ? whereComplejo : undefined,
          attributes: ['id', 'nombre', 'ubicacion', 'photo', 'wallpaper'],
          required: true
        },
        {
          model: Sports,
          as: 'sport',
          where: Object.keys(whereSport).length > 0 ? whereSport : undefined,
          attributes: ['id', 'name', 'state'],
          required: deporte ? true : false
        }
      ],
      order: [
        ['nombre', 'ASC'],
        [{ model: Complejos, as: 'complejo' }, 'nombre', 'ASC']
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    return {
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
        hasNext: page * limit < count,
        hasPrev: page > 1
      }
    };

  } catch (error) {
    console.error('Error en searchService.searchCourtsWithPagination:', error);
    throw error;
  }
};
