import { CalendarioExcepciones, Complejos } from '../db/db.js';

/**
 * Controller de Excepciones de Calendario - Zyra
 * Maneja fechas especiales (festivos, cierres, eventos) para complejos deportivos
 */

/**
 * POST /api/complexes/:id/excepciones
 * Agregar una fecha excepcional al calendario de un complejo
 * 
 * Body esperado:
 * {
 *   "fecha": "2026-05-18",
 *   "esta_abierto": true,
 *   "es_festivo": true,
 *   "descripcion": "Lunes de Ascensión"
 * }
 */
export const addException = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.id);
    const userId = req.user.id;
    const { fecha, esta_abierto, es_festivo, descripcion } = req.body;

    // Verificar que el complejo existe
    const complejo = await Complejos.findByPk(complejoId);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    // Verificar permisos
    if (complejo.dueño_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para configurar este complejo'
      });
    }

    // Validar fecha
    if (!fecha) {
      return res.status(400).json({
        success: false,
        message: 'La fecha es obligatoria'
      });
    }

    // Validar formato de fecha (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fecha)) {
      return res.status(400).json({
        success: false,
        message: 'La fecha debe estar en formato YYYY-MM-DD'
      });
    }

    // Validar que la fecha es válida
    const fechaObj = new Date(fecha + 'T00:00:00');
    if (isNaN(fechaObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Fecha inválida'
      });
    }

    // Verificar si ya existe una excepción para esta fecha en este complejo
    const excepcionExistente = await CalendarioExcepciones.findOne({
      where: { 
        complejo_id: complejoId,
        fecha: fecha
      }
    });

    if (excepcionExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una excepción configurada para esta fecha',
        data: {
          id: excepcionExistente.id,
          fecha: excepcionExistente.fecha,
          descripcion: excepcionExistente.descripcion
        }
      });
    }

    // Crear la excepción
    const excepcion = await CalendarioExcepciones.create({
      complejo_id: complejoId,
      fecha: fecha,
      esta_abierto: esta_abierto !== undefined ? esta_abierto : true,
      es_festivo: es_festivo !== undefined ? es_festivo : false,
      descripcion: descripcion || null
    });

    return res.status(201).json({
      success: true,
      message: 'Excepción de calendario creada exitosamente',
      data: {
        id: excepcion.id,
        complejo_id: complejoId,
        complejo_nombre: complejo.nombre,
        fecha: excepcion.fecha,
        esta_abierto: excepcion.esta_abierto,
        es_festivo: excepcion.es_festivo,
        descripcion: excepcion.descripcion,
        informacion: _getExceptionInfo(excepcion)
      }
    });

  } catch (error) {
    console.error('Error en addException:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al agregar excepción',
      error: error.message
    });
  }
};

/**
 * GET /api/complexes/:id/excepciones
 * Obtener todas las excepciones de calendario de un complejo
 * Query params opcionales:
 * - desde: fecha inicial (YYYY-MM-DD)
 * - hasta: fecha final (YYYY-MM-DD)
 * - solo_festivos: true/false
 * - solo_cerrados: true/false
 */
export const getExceptions = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.id);
    const { desde, hasta, solo_festivos, solo_cerrados } = req.query;

    // Verificar que el complejo existe
    const complejo = await Complejos.findByPk(complejoId);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    // Construir filtros
    const where = { complejo_id: complejoId };

    if (desde && hasta) {
      where.fecha = {
        [require('sequelize').Op.between]: [desde, hasta]
      };
    } else if (desde) {
      where.fecha = {
        [require('sequelize').Op.gte]: desde
      };
    } else if (hasta) {
      where.fecha = {
        [require('sequelize').Op.lte]: hasta
      };
    }

    if (solo_festivos === 'true') {
      where.es_festivo = true;
    }

    if (solo_cerrados === 'true') {
      where.esta_abierto = false;
    }

    // Obtener excepciones
    const excepciones = await CalendarioExcepciones.findAll({
      where,
      order: [['fecha', 'ASC']]
    });

    const excepcionesFormateadas = excepciones.map(exc => ({
      id: exc.id,
      fecha: exc.fecha,
      esta_abierto: exc.esta_abierto,
      es_festivo: exc.es_festivo,
      descripcion: exc.descripcion,
      informacion: _getExceptionInfo(exc)
    }));

    return res.status(200).json({
      success: true,
      message: 'Excepciones obtenidas exitosamente',
      data: {
        complejo_id: complejoId,
        complejo_nombre: complejo.nombre,
        total: excepciones.length,
        excepciones: excepcionesFormateadas,
        filtros_aplicados: {
          ...(desde && { desde }),
          ...(hasta && { hasta }),
          ...(solo_festivos && { solo_festivos }),
          ...(solo_cerrados && { solo_cerrados })
        }
      }
    });

  } catch (error) {
    console.error('Error en getExceptions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener excepciones',
      error: error.message
    });
  }
};

/**
 * GET /api/complexes/:id/excepciones/:fecha
 * Obtener información de una fecha específica
 */
export const getExceptionByDate = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.id);
    const { fecha } = req.params;

    // Verificar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fecha)) {
      return res.status(400).json({
        success: false,
        message: 'La fecha debe estar en formato YYYY-MM-DD'
      });
    }

    // Verificar que el complejo existe
    const complejo = await Complejos.findByPk(complejoId);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    // Buscar excepción
    const excepcion = await CalendarioExcepciones.findOne({
      where: {
        complejo_id: complejoId,
        fecha: fecha
      }
    });

    if (!excepcion) {
      return res.status(404).json({
        success: false,
        message: 'No hay excepción configurada para esta fecha',
        data: {
          complejo_id: complejoId,
          fecha: fecha,
          usa_horario_normal: true
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Excepción encontrada',
      data: {
        id: excepcion.id,
        complejo_id: complejoId,
        complejo_nombre: complejo.nombre,
        fecha: excepcion.fecha,
        esta_abierto: excepcion.esta_abierto,
        es_festivo: excepcion.es_festivo,
        descripcion: excepcion.descripcion,
        informacion: _getExceptionInfo(excepcion)
      }
    });

  } catch (error) {
    console.error('Error en getExceptionByDate:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener excepción',
      error: error.message
    });
  }
};

/**
 * PUT /api/complexes/:id/excepciones/:fecha
 * Actualizar una excepción de calendario
 */
export const updateException = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.id);
    const { fecha } = req.params;
    const userId = req.user.id;
    const { esta_abierto, es_festivo, descripcion } = req.body;

    // Buscar excepción
    const excepcion = await CalendarioExcepciones.findOne({
      where: {
        complejo_id: complejoId,
        fecha: fecha
      },
      include: [{
        model: Complejos,
        as: 'complejo',
        attributes: ['id', 'nombre', 'dueño_id']
      }]
    });

    if (!excepcion) {
      return res.status(404).json({
        success: false,
        message: 'Excepción no encontrada para esta fecha'
      });
    }

    // Verificar permisos
    if (excepcion.complejo.dueño_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este complejo'
      });
    }

    // Actualizar campos
    const updateData = {};
    if (esta_abierto !== undefined) updateData.esta_abierto = esta_abierto;
    if (es_festivo !== undefined) updateData.es_festivo = es_festivo;
    if (descripcion !== undefined) updateData.descripcion = descripcion;

    await excepcion.update(updateData);

    return res.status(200).json({
      success: true,
      message: 'Excepción actualizada exitosamente',
      data: {
        id: excepcion.id,
        complejo_id: complejoId,
        complejo_nombre: excepcion.complejo.nombre,
        fecha: excepcion.fecha,
        esta_abierto: excepcion.esta_abierto,
        es_festivo: excepcion.es_festivo,
        descripcion: excepcion.descripcion,
        informacion: _getExceptionInfo(excepcion)
      }
    });

  } catch (error) {
    console.error('Error en updateException:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar excepción',
      error: error.message
    });
  }
};

/**
 * DELETE /api/complexes/:id/excepciones/:fecha
 * Eliminar una excepción de calendario
 */
export const deleteException = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.id);
    const { fecha } = req.params;
    const userId = req.user.id;

    // Buscar excepción
    const excepcion = await CalendarioExcepciones.findOne({
      where: {
        complejo_id: complejoId,
        fecha: fecha
      },
      include: [{
        model: Complejos,
        as: 'complejo',
        attributes: ['dueño_id']
      }]
    });

    if (!excepcion) {
      return res.status(404).json({
        success: false,
        message: 'Excepción no encontrada para esta fecha'
      });
    }

    // Verificar permisos
    if (excepcion.complejo.dueño_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este complejo'
      });
    }

    // Eliminar
    await excepcion.destroy();

    return res.status(200).json({
      success: true,
      message: 'Excepción eliminada exitosamente',
      data: {
        complejo_id: complejoId,
        fecha: fecha
      }
    });

  } catch (error) {
    console.error('Error en deleteException:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar excepción',
      error: error.message
    });
  }
};

/**
 * POST /api/complexes/:id/excepciones/bulk
 * Agregar múltiples excepciones al mismo tiempo
 * 
 * Body esperado:
 * {
 *   "excepciones": [
 *     {
 *       "fecha": "2026-05-18",
 *       "esta_abierto": true,
 *       "es_festivo": true,
 *       "descripcion": "Lunes de Ascensión"
 *     },
 *     {
 *       "fecha": "2026-07-20",
 *       "esta_abierto": true,
 *       "es_festivo": true,
 *       "descripcion": "Día de la Independencia"
 *     }
 *   ]
 * }
 */
export const addBulkExceptions = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.id);
    const userId = req.user.id;
    const { excepciones } = req.body;

    // Verificar que el complejo existe
    const complejo = await Complejos.findByPk(complejoId);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    // Verificar permisos
    if (complejo.dueño_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para configurar este complejo'
      });
    }

    // Validar array
    if (!Array.isArray(excepciones) || excepciones.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un array de excepciones'
      });
    }

    // Validar cada excepción
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const exc of excepciones) {
      if (!exc.fecha || !dateRegex.test(exc.fecha)) {
        return res.status(400).json({
          success: false,
          message: 'Todas las fechas deben estar en formato YYYY-MM-DD'
        });
      }
    }

    // Verificar duplicados en el array
    const fechas = excepciones.map(e => e.fecha);
    const fechasUnicas = new Set(fechas);
    if (fechas.length !== fechasUnicas.size) {
      return res.status(400).json({
        success: false,
        message: 'Hay fechas duplicadas en el array'
      });
    }

    // Verificar si alguna ya existe en la BD
    const existentes = await CalendarioExcepciones.findAll({
      where: {
        complejo_id: complejoId,
        fecha: {
          [require('sequelize').Op.in]: fechas
        }
      }
    });

    if (existentes.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Algunas fechas ya tienen excepciones configuradas',
        data: {
          fechas_existentes: existentes.map(e => e.fecha)
        }
      });
    }

    // Crear todas las excepciones
    const excepcionesCreadas = await CalendarioExcepciones.bulkCreate(
      excepciones.map(exc => ({
        complejo_id: complejoId,
        fecha: exc.fecha,
        esta_abierto: exc.esta_abierto !== undefined ? exc.esta_abierto : true,
        es_festivo: exc.es_festivo !== undefined ? exc.es_festivo : false,
        descripcion: exc.descripcion || null
      }))
    );

    return res.status(201).json({
      success: true,
      message: `${excepcionesCreadas.length} excepciones creadas exitosamente`,
      data: {
        complejo_id: complejoId,
        complejo_nombre: complejo.nombre,
        total_creadas: excepcionesCreadas.length,
        excepciones: excepcionesCreadas.map(exc => ({
          id: exc.id,
          fecha: exc.fecha,
          esta_abierto: exc.esta_abierto,
          es_festivo: exc.es_festivo,
          descripcion: exc.descripcion,
          informacion: _getExceptionInfo(exc)
        }))
      }
    });

  } catch (error) {
    console.error('Error en addBulkExceptions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al agregar excepciones',
      error: error.message
    });
  }
};

// ============================================================
// HELPERS PRIVADOS
// ============================================================

/**
 * Helper para generar información legible de una excepción
 */
function _getExceptionInfo(excepcion) {
  let info = '';
  
  if (!excepcion.esta_abierto) {
    info = '🔒 Complejo cerrado';
  } else if (excepcion.es_festivo) {
    info = '🎉 Festivo - Precios especiales (tipo_dia: 7)';
  } else {
    info = '⚠️ Día especial con horario normal';
  }

  return info;
}
