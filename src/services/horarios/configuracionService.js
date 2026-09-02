import { ComplejoHorarios, CanchaHorariosPrecios, sequelize } from '../../db/db.js';

/**
 * Configura los horarios de un complejo de forma masiva
 * Usa bulkCreate con updateOnDuplicate para evitar duplicados
 * 
 * @param {number} complejo_id - ID del complejo
 * @param {Array<{
 *   dia_semana: number,
 *   hora_apertura: string,
 *   hora_cierre: string,
 *   esta_cerrado?: boolean
 * }>} horarios - Array de horarios a configurar
 * @returns {Promise<Array>} Horarios creados/actualizados
 * 
 * @example
 * await configurarHorariosComplejo(1, [
 *   { dia_semana: 1, hora_apertura: '08:00', hora_cierre: '22:00' }, // Lunes
 *   { dia_semana: 2, hora_apertura: '08:00', hora_cierre: '22:00' }, // Martes
 *   { dia_semana: 0, hora_apertura: '10:00', hora_cierre: '20:00' }, // Domingo
 * ]);
 */
export async function configurarHorariosComplejo(complejo_id, horarios) {
  const horariosConComplejo = horarios.map(h => ({
    complejo_id,
    dia_semana: h.dia_semana,
    hora_apertura: h.hora_apertura,
    hora_cierre: h.hora_cierre,
    esta_cerrado: h.esta_cerrado || false
  }));

  // bulkCreate con updateOnDuplicate requiere que exista un índice único
  // en (complejo_id, dia_semana) para que funcione correctamente
  const resultado = await ComplejoHorarios.bulkCreate(horariosConComplejo, {
    updateOnDuplicate: ['hora_apertura', 'hora_cierre', 'esta_cerrado']
  });

  return resultado;
}

/**
 * Configura horario estándar de lunes a viernes con un horario y sábado/domingo con otro
 * 
 * @param {number} complejo_id - ID del complejo
 * @param {object} config - Configuración de horarios
 * @param {string} config.lun_vie_apertura - Hora apertura lunes a viernes
 * @param {string} config.lun_vie_cierre - Hora cierre lunes a viernes
 * @param {string} config.sab_apertura - Hora apertura sábado
 * @param {string} config.sab_cierre - Hora cierre sábado
 * @param {string} config.dom_apertura - Hora apertura domingo
 * @param {string} config.dom_cierre - Hora cierre domingo
 * @returns {Promise<Array>}
 * 
 * @example
 * await configurarHorarioEstandar(1, {
 *   lun_vie_apertura: '08:00',
 *   lun_vie_cierre: '22:00',
 *   sab_apertura: '09:00',
 *   sab_cierre: '23:00',
 *   dom_apertura: '10:00',
 *   dom_cierre: '20:00'
 * });
 */
export async function configurarHorarioEstandar(complejo_id, config) {
  const horarios = [];

  // Lunes a Viernes (1-5)
  for (let dia = 1; dia <= 5; dia++) {
    horarios.push({
      dia_semana: dia,
      hora_apertura: config.lun_vie_apertura,
      hora_cierre: config.lun_vie_cierre
    });
  }

  // Sábado (6)
  horarios.push({
    dia_semana: 6,
    hora_apertura: config.sab_apertura,
    hora_cierre: config.sab_cierre
  });

  // Domingo (0)
  horarios.push({
    dia_semana: 0,
    hora_apertura: config.dom_apertura,
    hora_cierre: config.dom_cierre
  });

  return configurarHorariosComplejo(complejo_id, horarios);
}

/**
 * Marca un día como cerrado (festivo o mantenimiento)
 * 
 * @param {number} complejo_id - ID del complejo
 * @param {number} dia_semana - Día de la semana (0-6)
 * @param {boolean} cerrado - true para cerrar, false para abrir
 * @returns {Promise<[number, Array]>}
 */
export async function marcarDiaCerrado(complejo_id, dia_semana, cerrado = true) {
  return await ComplejoHorarios.update(
    { esta_cerrado: cerrado },
    {
      where: {
        complejo_id,
        dia_semana
      }
    }
  );
}

/**
 * Configura los precios de una cancha de forma masiva
 * Usa bulkCreate con updateOnDuplicate para evitar duplicados
 * 
 * @param {number} cancha_id - ID de la cancha
 * @param {Array<{
 *   tipo_dia: number,
 *   hora_inicio: string,
 *   hora_fin: string,
 *   precio_hora: number
 * }>} precios - Array de configuraciones de precios
 * @returns {Promise<Array>} Precios creados/actualizados
 * 
 * @example
 * await configurarPreciosCancha(1, [
 *   // Lunes: Día entero económico excepto horario pico
 *   { tipo_dia: 1, hora_inicio: '08:00', hora_fin: '18:00', precio_hora: 80000 },
 *   { tipo_dia: 1, hora_inicio: '18:00', hora_fin: '21:00', precio_hora: 120000 },
 *   { tipo_dia: 1, hora_inicio: '21:00', hora_fin: '22:00', precio_hora: 80000 },
 * ]);
 */
export async function configurarPreciosCancha(cancha_id, precios) {
  const preciosConCancha = precios.map(p => ({
    cancha_id,
    tipo_dia: p.tipo_dia,
    hora_inicio: p.hora_inicio,
    hora_fin: p.hora_fin,
    precio_hora: p.precio_hora
  }));

  // bulkCreate con updateOnDuplicate requiere índice único
  // en (cancha_id, tipo_dia, hora_inicio) o similar
  const resultado = await CanchaHorariosPrecios.bulkCreate(preciosConCancha, {
    updateOnDuplicate: ['hora_fin', 'precio_hora']
  });

  return resultado;
}

/**
 * Configura precios estándar: horario normal y horario pico
 * 
 * @param {number} cancha_id - ID de la cancha
 * @param {object} config - Configuración de precios
 * @param {Array<number>} config.dias - Días a configurar (ej: [1,2,3,4,5] para L-V)
 * @param {string} config.hora_pico_inicio - Inicio horario pico (ej: '18:00')
 * @param {string} config.hora_pico_fin - Fin horario pico (ej: '21:00')
 * @param {number} config.precio_normal - Precio horario normal
 * @param {number} config.precio_pico - Precio horario pico
 * @param {string} config.hora_apertura - Hora de apertura del complejo
 * @param {string} config.hora_cierre - Hora de cierre del complejo
 * @returns {Promise<Array>}
 * 
 * @example
 * // Configurar Lunes a Viernes con horario pico
 * await configurarPrecioEstandar(1, {
 *   dias: [1, 2, 3, 4, 5],
 *   hora_apertura: '08:00',
 *   hora_cierre: '22:00',
 *   hora_pico_inicio: '18:00',
 *   hora_pico_fin: '21:00',
 *   precio_normal: 80000,
 *   precio_pico: 120000
 * });
 */
export async function configurarPrecioEstandar(cancha_id, config) {
  const precios = [];

  for (const dia of config.dias) {
    // Bloque 1: Desde apertura hasta inicio del horario pico
    precios.push({
      tipo_dia: dia,
      hora_inicio: config.hora_apertura,
      hora_fin: config.hora_pico_inicio,
      precio_hora: config.precio_normal
    });

    // Bloque 2: Horario pico
    precios.push({
      tipo_dia: dia,
      hora_inicio: config.hora_pico_inicio,
      hora_fin: config.hora_pico_fin,
      precio_hora: config.precio_pico
    });

    // Bloque 3: Desde fin del horario pico hasta cierre
    precios.push({
      tipo_dia: dia,
      hora_inicio: config.hora_pico_fin,
      hora_fin: config.hora_cierre,
      precio_hora: config.precio_normal
    });
  }

  return configurarPreciosCancha(cancha_id, precios);
}

/**
 * Configura un precio único para todo el día
 * 
 * @param {number} cancha_id - ID de la cancha
 * @param {number} tipo_dia - Día de la semana (0-6)
 * @param {string} hora_inicio - Hora de inicio
 * @param {string} hora_fin - Hora de fin
 * @param {number} precio_hora - Precio por hora
 * @returns {Promise<Array>}
 * 
 * @example
 * // Domingo con precio único todo el día
 * await configurarPrecioSimple(1, 0, '10:00', '20:00', 100000);
 */
export async function configurarPrecioSimple(cancha_id, tipo_dia, hora_inicio, hora_fin, precio_hora) {
  return configurarPreciosCancha(cancha_id, [{
    tipo_dia,
    hora_inicio,
    hora_fin,
    precio_hora
  }]);
}

/**
 * Elimina todos los precios de una cancha para un día específico
 * Útil para reconfigurar desde cero
 * 
 * @param {number} cancha_id - ID de la cancha
 * @param {number} tipo_dia - Día de la semana (0-6)
 * @returns {Promise<number>} Cantidad de registros eliminados
 */
export async function limpiarPreciosDia(cancha_id, tipo_dia) {
  return await CanchaHorariosPrecios.destroy({
    where: {
      cancha_id,
      tipo_dia
    }
  });
}

/**
 * Elimina todos los precios de una cancha
 * 
 * @param {number} cancha_id - ID de la cancha
 * @returns {Promise<number>} Cantidad de registros eliminados
 */
export async function limpiarPreciosCancha(cancha_id) {
  return await CanchaHorariosPrecios.destroy({
    where: { cancha_id }
  });
}

/**
 * Elimina todos los horarios de un complejo
 * 
 * @param {number} complejo_id - ID del complejo
 * @returns {Promise<number>} Cantidad de registros eliminados
 */
export async function limpiarHorariosComplejo(complejo_id) {
  return await ComplejoHorarios.destroy({
    where: { complejo_id }
  });
}

/**
 * Configura completo un complejo y sus canchas con horarios y precios
 * Esta es una función de conveniencia para setup inicial
 * 
 * @param {object} config - Configuración completa
 * @returns {Promise<object>} Resultado de la configuración
 * 
 * @example
 * await configurarComplejoCompleto({
 *   complejo_id: 1,
 *   horarios_complejo: {
 *     lun_vie_apertura: '08:00',
 *     lun_vie_cierre: '22:00',
 *     sab_apertura: '09:00',
 *     sab_cierre: '23:00',
 *     dom_apertura: '10:00',
 *     dom_cierre: '20:00'
 *   },
 *   canchas: [
 *     {
 *       cancha_id: 1,
 *       precios_lun_vie: {
 *         hora_apertura: '08:00',
 *         hora_cierre: '22:00',
 *         hora_pico_inicio: '18:00',
 *         hora_pico_fin: '21:00',
 *         precio_normal: 80000,
 *         precio_pico: 120000
 *       },
 *       precios_sab: { hora_inicio: '09:00', hora_fin: '23:00', precio: 100000 },
 *       precios_dom: { hora_inicio: '10:00', hora_fin: '20:00', precio: 100000 }
 *     }
 *   ]
 * });
 */
export async function configurarComplejoCompleto(config) {
  const transaction = await sequelize.transaction();

  try {
    // 1. Configurar horarios del complejo
    const horariosComplejo = await configurarHorarioEstandar(
      config.complejo_id,
      config.horarios_complejo
    );

    // 2. Configurar precios de cada cancha
    const resultadoCanchas = [];

    for (const canchaConfig of config.canchas) {
      // Lunes a Viernes
      if (canchaConfig.precios_lun_vie) {
        await configurarPrecioEstandar(canchaConfig.cancha_id, {
          dias: [1, 2, 3, 4, 5],
          ...canchaConfig.precios_lun_vie
        });
      }

      // Sábado
      if (canchaConfig.precios_sab) {
        await configurarPrecioSimple(
          canchaConfig.cancha_id,
          6,
          canchaConfig.precios_sab.hora_inicio,
          canchaConfig.precios_sab.hora_fin,
          canchaConfig.precios_sab.precio
        );
      }

      // Domingo
      if (canchaConfig.precios_dom) {
        await configurarPrecioSimple(
          canchaConfig.cancha_id,
          0,
          canchaConfig.precios_dom.hora_inicio,
          canchaConfig.precios_dom.hora_fin,
          canchaConfig.precios_dom.precio
        );
      }

      resultadoCanchas.push({
        cancha_id: canchaConfig.cancha_id,
        configurado: true
      });
    }

    await transaction.commit();

    return {
      success: true,
      horarios_complejo: horariosComplejo.length,
      canchas_configuradas: resultadoCanchas.length,
      detalles: resultadoCanchas
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
