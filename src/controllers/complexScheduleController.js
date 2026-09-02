import {
  configurarHorariosComplejo,
  configurarHorarioEstandar,
  marcarDiaCerrado,
  limpiarHorariosComplejo
} from '../services/horarios/configuracionService.js';
import { getHorariosComplejo } from '../services/horarios/horariosService.js';
import { Complejos } from '../db/db.js';

/**
 * Controller de Horarios de Complejos - Zyra
 * Maneja las peticiones HTTP para la gestión de horarios de complejos deportivos
 */

/**
 * POST /api/complexes/:id/horarios
 * Configurar horarios de un complejo (personalizado)
 * 
 * Body esperado:
 * {
 *   "horarios": [
 *     { "dia_semana": 1, "hora_apertura": "08:00", "hora_cierre": "22:00" },
 *     { "dia_semana": 2, "hora_apertura": "08:00", "hora_cierre": "22:00" },
 *     ...
 *   ]
 * }
 */
export const setSchedules = async (req, res) => {
  try {
    const complexId = parseInt(req.params.id);
    const ownerId = req.user.id;
    const { horarios } = req.body;

    // Validar que el complejo existe y pertenece al usuario
    const complejo = await Complejos.findByPk(complexId);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    if (complejo.dueño_id !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para configurar este complejo'
      });
    }

    // Validar formato de horarios
    if (!Array.isArray(horarios) || horarios.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes proporcionar un array de horarios válido'
      });
    }

    // Validar cada horario
    for (const horario of horarios) {
      if (
        horario.dia_semana === undefined ||
        horario.dia_semana < 0 ||
        horario.dia_semana > 6
      ) {
        return res.status(400).json({
          success: false,
          message: 'dia_semana debe ser un número entre 0 (Domingo) y 6 (Sábado)'
        });
      }

      if (!horario.hora_apertura || !horario.hora_cierre) {
        return res.status(400).json({
          success: false,
          message: 'hora_apertura y hora_cierre son obligatorios'
        });
      }

      // Validar formato de hora (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(horario.hora_apertura) || !timeRegex.test(horario.hora_cierre)) {
        return res.status(400).json({
          success: false,
          message: 'Las horas deben estar en formato HH:MM (24 horas)'
        });
      }
    }

    // Configurar horarios
    await configurarHorariosComplejo(complexId, horarios);

    // Obtener horarios configurados
    const horariosConfigurados = await getHorariosComplejo(complexId);

    res.status(200).json({
      success: true,
      message: 'Horarios configurados exitosamente',
      data: {
        complejo_id: complexId,
        horarios: horariosConfigurados
      }
    });

  } catch (error) {
    console.error('Error al configurar horarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al configurar horarios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/complexes/:id/horarios/estandar
 * Configurar horario estándar (L-V, Sábado, Domingo)
 * 
 * Body esperado:
 * {
 *   "lun_vie_apertura": "08:00",
 *   "lun_vie_cierre": "22:00",
 *   "sab_apertura": "09:00",
 *   "sab_cierre": "23:00",
 *   "dom_apertura": "10:00",
 *   "dom_cierre": "20:00"
 * }
 */
export const setStandardSchedule = async (req, res) => {
  try {
    const complexId = parseInt(req.params.id);
    const ownerId = req.user.id;
    const {
      lun_vie_apertura,
      lun_vie_cierre,
      sab_apertura,
      sab_cierre,
      dom_apertura,
      dom_cierre
    } = req.body;

    // Validar que el complejo existe y pertenece al usuario
    const complejo = await Complejos.findByPk(complexId);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    if (complejo.dueño_id !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para configurar este complejo'
      });
    }

    // Validar que todos los campos estén presentes
    if (
      !lun_vie_apertura || !lun_vie_cierre ||
      !sab_apertura || !sab_cierre ||
      !dom_apertura || !dom_cierre
    ) {
      return res.status(400).json({
        success: false,
        message: 'Todos los horarios son obligatorios (lun_vie, sab, dom)'
      });
    }

    // Validar formato de hora (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const horas = [
      lun_vie_apertura, lun_vie_cierre,
      sab_apertura, sab_cierre,
      dom_apertura, dom_cierre
    ];

    for (const hora of horas) {
      if (!timeRegex.test(hora)) {
        return res.status(400).json({
          success: false,
          message: 'Las horas deben estar en formato HH:MM (24 horas)'
        });
      }
    }

    // Configurar horario estándar
    await configurarHorarioEstandar(complexId, {
      lun_vie_apertura,
      lun_vie_cierre,
      sab_apertura,
      sab_cierre,
      dom_apertura,
      dom_cierre
    });

    // Obtener horarios configurados
    const horariosConfigurados = await getHorariosComplejo(complexId);

    res.status(200).json({
      success: true,
      message: 'Horario estándar configurado exitosamente',
      data: {
        complejo_id: complexId,
        horarios: horariosConfigurados
      }
    });

  } catch (error) {
    console.error('Error al configurar horario estándar:', error);
    res.status(500).json({
      success: false,
      message: 'Error al configurar horario estándar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/complexes/:id/horarios
 * Obtener los horarios configurados de un complejo
 */
export const getSchedules = async (req, res) => {
  try {
    const complexId = parseInt(req.params.id);

    // Validar que el complejo existe
    const complejo = await Complejos.findByPk(complexId);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    // Obtener horarios
    const horarios = await getHorariosComplejo(complexId);

    res.status(200).json({
      success: true,
      message: 'Horarios del complejo',
      data: {
        complejo_id: complexId,
        complejo_nombre: complejo.nombre,
        horarios
      }
    });

  } catch (error) {
    console.error('Error al obtener horarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener horarios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PATCH /api/complexes/:id/horarios/:dia
 * Actualizar el estado de un día específico (marcar como cerrado o abierto)
 * 
 * Body esperado:
 * {
 *   "esta_cerrado": true
 * }
 */
export const updateDayStatus = async (req, res) => {
  try {
    const complexId = parseInt(req.params.id);
    const diaSemana = parseInt(req.params.dia);
    const ownerId = req.user.id;
    const { esta_cerrado } = req.body;

    // Validar que el complejo existe y pertenece al usuario
    const complejo = await Complejos.findByPk(complexId);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    if (complejo.dueño_id !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para configurar este complejo'
      });
    }

    // Validar día de la semana
    if (isNaN(diaSemana) || diaSemana < 0 || diaSemana > 6) {
      return res.status(400).json({
        success: false,
        message: 'El día debe ser un número entre 0 (Domingo) y 6 (Sábado)'
      });
    }

    // Validar que esta_cerrado sea boolean
    if (typeof esta_cerrado !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'esta_cerrado debe ser true o false'
      });
    }

    // Actualizar estado
    const [updated] = await marcarDiaCerrado(complexId, diaSemana, esta_cerrado);

    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: 'No existe horario configurado para este día'
      });
    }

    // Obtener horarios actualizados
    const horarios = await getHorariosComplejo(complexId);

    res.status(200).json({
      success: true,
      message: `Día ${esta_cerrado ? 'marcado como cerrado' : 'abierto'} exitosamente`,
      data: {
        complejo_id: complexId,
        dia_actualizado: diaSemana,
        esta_cerrado,
        horarios
      }
    });

  } catch (error) {
    console.error('Error al actualizar estado del día:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado del día',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE /api/complexes/:id/horarios
 * Eliminar todos los horarios de un complejo
 */
export const deleteSchedules = async (req, res) => {
  try {
    const complexId = parseInt(req.params.id);
    const ownerId = req.user.id;

    // Validar que el complejo existe y pertenece al usuario
    const complejo = await Complejos.findByPk(complexId);
    
    if (!complejo) {
      return res.status(404).json({
        success: false,
        message: 'Complejo no encontrado'
      });
    }

    if (complejo.dueño_id !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para configurar este complejo'
      });
    }

    // Eliminar horarios
    const deletedCount = await limpiarHorariosComplejo(complexId);

    res.status(200).json({
      success: true,
      message: 'Horarios eliminados exitosamente',
      data: {
        complejo_id: complexId,
        horarios_eliminados: deletedCount
      }
    });

  } catch (error) {
    console.error('Error al eliminar horarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar horarios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
