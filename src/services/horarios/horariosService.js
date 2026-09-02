import { ComplejoHorarios, CanchaHorariosPrecios, Complejos, Canchas } from '../../db/db.js';
import { Op } from 'sequelize';

/**
 * Obtiene el día de la semana según el estándar de Zyra
 * @param {Date} fecha - La fecha a convertir
 * @returns {number} 0 (Domingo) a 6 (Sábado)
 */
export function getDiaSemana(fecha) {
  return fecha.getDay(); // JavaScript ya usa 0=Domingo, 6=Sábado
}

/**
 * Convierte una hora (HH:MM o HH:MM:SS) a minutos desde medianoche
 * @param {string} hora - Hora en formato HH:MM o HH:MM:SS
 * @returns {number} Minutos desde medianoche
 */
export function horaAMinutos(hora) {
  if (!hora) return null;
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
}

/**
 * Verifica si una hora está dentro del rango de apertura del complejo
 * @param {number} complejo_id - ID del complejo
 * @param {number} dia_semana - Día de la semana (0-6)
 * @param {string} hora - Hora a verificar (HH:MM)
 * @returns {Promise<{abierto: boolean, horario: object|null, mensaje: string}>}
 */
export async function verificarComplejoAbierto(complejo_id, dia_semana, hora) {
  const horario = await ComplejoHorarios.findOne({
    where: {
      complejo_id,
      dia_semana
    }
  });

  if (!horario) {
    return {
      abierto: false,
      horario: null,
      mensaje: 'No hay horario configurado para este día'
    };
  }

  // Si está marcado como cerrado (festivo, mantenimiento, etc.)
  if (horario.esta_cerrado) {
    return {
      abierto: false,
      horario,
      mensaje: 'Complejo cerrado (festivo o mantenimiento)'
    };
  }

  // Verificar rango horario
  const horaMinutos = horaAMinutos(hora);
  const aperturaMinutos = horaAMinutos(horario.hora_apertura);
  const cierreMinutos = horaAMinutos(horario.hora_cierre);

  if (horaMinutos < aperturaMinutos || horaMinutos >= cierreMinutos) {
    return {
      abierto: false,
      horario,
      mensaje: `Complejo cerrado. Horario: ${horario.hora_apertura} - ${horario.hora_cierre}`
    };
  }

  return {
    abierto: true,
    horario,
    mensaje: 'Complejo abierto'
  };
}

/**
 * Busca el precio configurado para una cancha en un día y hora específicos
 * @param {number} cancha_id - ID de la cancha
 * @param {number} tipo_dia - Día de la semana (0-6) o 7 para festivo
 * @param {string} hora - Hora a verificar (HH:MM)
 * @returns {Promise<object|null>} Configuración de precio o null si no existe
 */
export async function buscarPrecioPorHora(cancha_id, tipo_dia, hora) {
  const horaMinutos = horaAMinutos(hora);

  // Buscar todas las configuraciones de precio para esa cancha y día
  const precios = await CanchaHorariosPrecios.findAll({
    where: {
      cancha_id,
      tipo_dia
    }
  });

  // Encontrar el bloque que contiene la hora solicitada
  for (const precio of precios) {
    const inicioMinutos = horaAMinutos(precio.hora_inicio);
    const finMinutos = horaAMinutos(precio.hora_fin);

    // Verificar si la hora está dentro del rango [hora_inicio, hora_fin)
    if (horaMinutos >= inicioMinutos && horaMinutos < finMinutos) {
      return precio;
    }
  }

  return null;
}

/**
 * FUNCIÓN PRINCIPAL: Obtiene el precio disponible para una cancha en una fecha/hora específica
 * @param {number} cancha_id - ID de la cancha
 * @param {Date|string} fecha - Fecha de la reserva
 * @param {string} hora - Hora en formato HH:MM
 * @returns {Promise<{
 *   disponible: boolean,
 *   precio: number|null,
 *   mensaje: string,
 *   detalles: object|null
 * }>}
 */
export async function getAvailablePrice(cancha_id, fecha, hora) {
  try {
    // Convertir fecha a objeto Date si es string
    const fechaObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
    
    // Obtener día de la semana
    const dia_semana = getDiaSemana(fechaObj);

    // 1. Verificar que la cancha existe y obtener su complejo
    const cancha = await Canchas.findByPk(cancha_id, {
      include: [{
        model: Complejos,
        as: 'complejo',
        attributes: ['id', 'nombre']
      }]
    });

    if (!cancha) {
      return {
        disponible: false,
        precio: null,
        mensaje: 'Cancha no encontrada',
        detalles: null
      };
    }

    const complejo_id = cancha.complejo_id;

    // 2. Verificar que el complejo esté abierto en ese día/hora
    const estadoComplejo = await verificarComplejoAbierto(complejo_id, dia_semana, hora);
    
    if (!estadoComplejo.abierto) {
      return {
        disponible: false,
        precio: null,
        mensaje: estadoComplejo.mensaje,
        detalles: {
          cancha_id,
          dia_semana,
          hora,
          horario_complejo: estadoComplejo.horario
        }
      };
    }

    // 3. Buscar el precio configurado para esa cancha en ese bloque horario
    const configuracionPrecio = await buscarPrecioPorHora(cancha_id, dia_semana, hora);

    if (!configuracionPrecio) {
      return {
        disponible: false,
        precio: null,
        mensaje: 'No hay precio configurado para este horario',
        detalles: {
          cancha_id,
          dia_semana,
          hora,
          horario_complejo: estadoComplejo.horario
        }
      };
    }

    // 4. Todo OK - retornar precio
    return {
      disponible: true,
      precio: parseFloat(configuracionPrecio.precio_hora),
      mensaje: 'Precio disponible',
      detalles: {
        cancha_id,
        cancha_nombre: cancha.nombre,
        complejo_id,
        complejo_nombre: cancha.complejo?.nombre,
        dia_semana,
        hora,
        bloque_horario: {
          inicio: configuracionPrecio.hora_inicio,
          fin: configuracionPrecio.hora_fin
        },
        horario_complejo: estadoComplejo.horario
      }
    };

  } catch (error) {
    console.error('Error en getAvailablePrice:', error);
    return {
      disponible: false,
      precio: null,
      mensaje: `Error al consultar precio: ${error.message}`,
      detalles: null
    };
  }
}

/**
 * Obtiene todos los precios configurados para una cancha
 * @param {number} cancha_id - ID de la cancha
 * @returns {Promise<Array>} Lista de configuraciones de precios agrupadas por día
 */
export async function getPreciosPorCancha(cancha_id) {
  const precios = await CanchaHorariosPrecios.findAll({
    where: { cancha_id },
    order: [
      ['tipo_dia', 'ASC'],
      ['hora_inicio', 'ASC']
    ]
  });

  // Agrupar por día
  const preciosPorDia = {};
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Festivo'];

  precios.forEach(precio => {
    const dia = precio.tipo_dia;
    if (!preciosPorDia[dia]) {
      preciosPorDia[dia] = {
        dia_numero: dia,
        dia_nombre: diasSemana[dia] || 'Desconocido',
        bloques: []
      };
    }
    preciosPorDia[dia].bloques.push({
      hora_inicio: precio.hora_inicio,
      hora_fin: precio.hora_fin,
      precio_hora: parseFloat(precio.precio_hora)
    });
  });

  return Object.values(preciosPorDia);
}

/**
 * Obtiene el horario completo de un complejo
 * @param {number} complejo_id - ID del complejo
 * @returns {Promise<Array>} Lista de horarios por día
 */
export async function getHorariosComplejo(complejo_id) {
  const horarios = await ComplejoHorarios.findAll({
    where: { complejo_id },
    order: [['dia_semana', 'ASC']]
  });

  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return horarios.map(horario => ({
    dia_numero: horario.dia_semana,
    dia_nombre: diasSemana[horario.dia_semana],
    hora_apertura: horario.hora_apertura,
    hora_cierre: horario.hora_cierre,
    esta_cerrado: horario.esta_cerrado
  }));
}
