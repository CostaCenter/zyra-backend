import { Canchas, CanchaHorariosPrecios, Complejos, sequelize } from '../db/db.js';

/**
 * Controller de Precios de Canchas - Zyra
 * Maneja la configuración de precios dinámicos por franjas horarias y tipos de día
 */

// ============================================
// MAPAS DE CONVERSIÓN DÍAS
// ============================================
const DIA_A_ETIQUETA = {
  0: 'Do',
  1: 'Lu',
  2: 'Ma',
  3: 'Mi',
  4: 'Ju',
  5: 'Vi',
  6: 'Sá',
  7: 'Fes'
};

const ETIQUETA_A_DIA = {
  'Do': 0,
  'Lu': 1,
  'Ma': 2,
  'Mi': 3,
  'Ju': 4,
  'Vi': 5,
  'Sá': 6,
  'Fes': 7
};

/** Orden de la semana: Lu → Do, Festivos al final */
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0, 7];

/**
 * Índice de orden de un bloque según su día más temprano en la semana.
 * Bloques solo festivos quedan al final.
 */
const indiceOrdenBloque = (diasEtiquetas) => {
  const numeros = diasEtiquetas
    .map((etiqueta) => ETIQUETA_A_DIA[etiqueta])
    .filter((n) => n !== undefined);

  if (numeros.length === 0) return ORDEN_DIAS.length;

  return Math.min(...numeros.map((n) => ORDEN_DIAS.indexOf(n)));
};

/**
 * Ordena bloques: Lunes primero, Sábado/Domingo después, Festivos al final.
 */
const ordenarBloquesPorDiaSemana = (bloques) =>
  [...bloques].sort(
    (a, b) => indiceOrdenBloque(a.dias) - indiceOrdenBloque(b.dias)
  );

/**
 * Normaliza el formato de hora para consistencia (HH:MM)
 * Sequelize puede retornar TIME como "HH:MM:SS" o "HH:MM"
 */
const normalizarHora = (hora) => {
  if (!hora) return null;
  const str = hora.toString();
  return str.substring(0, 5); // Retorna solo HH:MM
};

/**
 * POST /api/courts/:id/precios
 * Configurar precios por franjas horarias para una cancha
 * 
 * Body esperado:
 * {
 *   "precios": [
 *     {
 *       "tipo_dia": 1,
 *       "hora_inicio": "08:00",
 *       "hora_fin": "14:00",
 *       "precio_hora": 50000
 *     },
 *     {
 *       "tipo_dia": 1,
 *       "hora_inicio": "14:00",
 *       "hora_fin": "22:00",
 *       "precio_hora": 80000
 *     }
 *   ]
 * }
 */
export const setPrices = async (req, res) => {
  try {
    const canchaId = parseInt(req.params.id);
    const userId = req.user.id;
    const { precios } = req.body;

    // Validar que la cancha existe
    const cancha = await Canchas.findByPk(canchaId, {
      include: [{
        model: Complejos,
        as: 'complejo',
        attributes: ['id', 'dueño_id']
      }]
    });

    if (!cancha) {
      return res.status(404).json({
        success: false,
        message: 'Cancha no encontrada'
      });
    }

    // Verificar que el usuario es dueño del complejo
    if (cancha.complejo.dueño_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para configurar precios de esta cancha'
      });
    }

    // Validar estructura del body
    if (!Array.isArray(precios) || precios.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar un array de precios'
      });
    }

    // Validar cada entrada
    for (const precio of precios) {
      if (precio.tipo_dia === undefined || precio.tipo_dia < 0 || precio.tipo_dia > 7) {
        return res.status(400).json({
          success: false,
          message: 'tipo_dia debe ser un número entre 0 (Domingo) y 7 (Festivo)'
        });
      }

      if (!precio.hora_inicio || !precio.hora_fin) {
        return res.status(400).json({
          success: false,
          message: 'hora_inicio y hora_fin son obligatorios'
        });
      }

      // Validar formato de hora (HH:MM)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(precio.hora_inicio) || !timeRegex.test(precio.hora_fin)) {
        return res.status(400).json({
          success: false,
          message: 'Las horas deben estar en formato HH:MM (24 horas)'
        });
      }

      if (precio.precio_hora === undefined || precio.precio_hora < 0) {
        return res.status(400).json({
          success: false,
          message: 'precio_hora debe ser un número mayor o igual a 0'
        });
      }
    }

    // Eliminar precios anteriores de esta cancha (reconfiguración completa)
    await CanchaHorariosPrecios.destroy({
      where: { cancha_id: canchaId }
    });

    // Insertar nuevos precios
    const preciosCreados = await CanchaHorariosPrecios.bulkCreate(
      precios.map(p => ({
        cancha_id: canchaId,
        tipo_dia: p.tipo_dia,
        hora_inicio: p.hora_inicio,
        hora_fin: p.hora_fin,
        precio_hora: p.precio_hora
      }))
    );

    // Formatear respuesta
    const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Festivo'];
    
    const preciosAgrupados = {};
    for (const precio of preciosCreados) {
      const dia = precio.tipo_dia;
      if (!preciosAgrupados[dia]) {
        preciosAgrupados[dia] = {
          tipo_dia: dia,
          dia_nombre: DIAS[dia] || 'Desconocido',
          franjas: []
        };
      }
      preciosAgrupados[dia].franjas.push({
        hora_inicio: precio.hora_inicio,
        hora_fin: precio.hora_fin,
        precio_hora: parseFloat(precio.precio_hora)
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Precios configurados exitosamente',
      data: {
        cancha_id: canchaId,
        cancha_nombre: cancha.nombre,
        precios: Object.values(preciosAgrupados)
      }
    });

  } catch (error) {
    console.error('Error en setPrices:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al configurar precios',
      error: error.message
    });
  }
};

/**
 * GET /api/courts/:id/precios
 * Obtener la configuración de precios de una cancha
 */
export const getPrices = async (req, res) => {
  try {
    const canchaId = parseInt(req.params.id);

    // Verificar que la cancha existe
    const cancha = await Canchas.findByPk(canchaId);
    if (!cancha) {
      return res.status(404).json({
        success: false,
        message: 'Cancha no encontrada'
      });
    }

    // Obtener precios configurados
    const precios = await CanchaHorariosPrecios.findAll({
      where: { cancha_id: canchaId },
      order: [['tipo_dia', 'ASC'], ['hora_inicio', 'ASC']]
    });

    const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Festivo'];

    // Si no hay precios configurados, usar el precio base
    if (precios.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'La cancha usa precio base (sin configuración dinámica)',
        data: {
          cancha_id: canchaId,
          cancha_nombre: cancha.nombre,
          precio_base: parseFloat(cancha.precio_hora || 0),
          tiene_precios_dinamicos: false,
          precios: []
        }
      });
    }

    // Agrupar por día
    const preciosAgrupados = {};
    for (const precio of precios) {
      const dia = precio.tipo_dia;
      if (!preciosAgrupados[dia]) {
        preciosAgrupados[dia] = {
          tipo_dia: dia,
          dia_nombre: DIAS[dia] || 'Desconocido',
          franjas: []
        };
      }
      preciosAgrupados[dia].franjas.push({
        id: precio.id,
        hora_inicio: precio.hora_inicio,
        hora_fin: precio.hora_fin,
        precio_hora: parseFloat(precio.precio_hora)
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Configuración de precios obtenida exitosamente',
      data: {
        cancha_id: canchaId,
        cancha_nombre: cancha.nombre,
        precio_base: parseFloat(cancha.precio_hora || 0),
        tiene_precios_dinamicos: true,
        precios: Object.values(preciosAgrupados)
      }
    });

  } catch (error) {
    console.error('Error en getPrices:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener precios',
      error: error.message
    });
  }
};

/**
 * PUT /api/courts/:id/precios/:precioId
 * Actualizar una franja de precio específica
 */
export const updatePrice = async (req, res) => {
  try {
    const canchaId = parseInt(req.params.id);
    const precioId = parseInt(req.params.precioId);
    const userId = req.user.id;
    const { hora_inicio, hora_fin, precio_hora } = req.body;

    // Verificar que el precio existe y pertenece a la cancha
    const precioExistente = await CanchaHorariosPrecios.findOne({
      where: { id: precioId, cancha_id: canchaId },
      include: [{
        model: Canchas,
        as: 'cancha',
        include: [{
          model: Complejos,
          as: 'complejo',
          attributes: ['dueño_id']
        }]
      }]
    });

    if (!precioExistente) {
      return res.status(404).json({
        success: false,
        message: 'Configuración de precio no encontrada'
      });
    }

    // Verificar permisos
    if (precioExistente.cancha.complejo.dueño_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar esta configuración'
      });
    }

    // Validar datos
    const updateData = {};
    
    if (hora_inicio !== undefined) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(hora_inicio)) {
        return res.status(400).json({
          success: false,
          message: 'hora_inicio debe estar en formato HH:MM'
        });
      }
      updateData.hora_inicio = hora_inicio;
    }

    if (hora_fin !== undefined) {
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(hora_fin)) {
        return res.status(400).json({
          success: false,
          message: 'hora_fin debe estar en formato HH:MM'
        });
      }
      updateData.hora_fin = hora_fin;
    }

    if (precio_hora !== undefined) {
      if (precio_hora < 0) {
        return res.status(400).json({
          success: false,
          message: 'precio_hora debe ser mayor o igual a 0'
        });
      }
      updateData.precio_hora = precio_hora;
    }

    // Actualizar
    await precioExistente.update(updateData);

    const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Festivo'];

    return res.status(200).json({
      success: true,
      message: 'Precio actualizado exitosamente',
      data: {
        id: precioExistente.id,
        cancha_id: canchaId,
        tipo_dia: precioExistente.tipo_dia,
        dia_nombre: DIAS[precioExistente.tipo_dia],
        hora_inicio: precioExistente.hora_inicio,
        hora_fin: precioExistente.hora_fin,
        precio_hora: parseFloat(precioExistente.precio_hora)
      }
    });

  } catch (error) {
    console.error('Error en updatePrice:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar precio',
      error: error.message
    });
  }
};

/**
 * DELETE /api/courts/:id/precios/:precioId
 * Eliminar una franja de precio específica
 */
export const deletePrice = async (req, res) => {
  try {
    const canchaId = parseInt(req.params.id);
    const precioId = parseInt(req.params.precioId);
    const userId = req.user.id;

    // Verificar que el precio existe
    const precioExistente = await CanchaHorariosPrecios.findOne({
      where: { id: precioId, cancha_id: canchaId },
      include: [{
        model: Canchas,
        as: 'cancha',
        include: [{
          model: Complejos,
          as: 'complejo',
          attributes: ['dueño_id']
        }]
      }]
    });

    if (!precioExistente) {
      return res.status(404).json({
        success: false,
        message: 'Configuración de precio no encontrada'
      });
    }

    // Verificar permisos
    if (precioExistente.cancha.complejo.dueño_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar esta configuración'
      });
    }

    // Eliminar
    await precioExistente.destroy();

    return res.status(200).json({
      success: true,
      message: 'Precio eliminado exitosamente',
      data: {
        id: precioId,
        cancha_id: canchaId
      }
    });

  } catch (error) {
    console.error('Error en deletePrice:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar precio',
      error: error.message
    });
  }
};

/**
 * DELETE /api/courts/:id/precios
 * Eliminar todas las configuraciones de precios de una cancha
 * (volver a usar precio base)
 */
export const deleteAllPrices = async (req, res) => {
  try {
    const canchaId = parseInt(req.params.id);
    const userId = req.user.id;

    // Verificar que la cancha existe
    const cancha = await Canchas.findByPk(canchaId, {
      include: [{
        model: Complejos,
        as: 'complejo',
        attributes: ['dueño_id']
      }]
    });

    if (!cancha) {
      return res.status(404).json({
        success: false,
        message: 'Cancha no encontrada'
      });
    }

    // Verificar permisos
    if (cancha.complejo.dueño_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar esta cancha'
      });
    }

    // Eliminar todos los precios
    const deleted = await CanchaHorariosPrecios.destroy({
      where: { cancha_id: canchaId }
    });

    return res.status(200).json({
      success: true,
      message: `Todos los precios dinámicos eliminados. La cancha usará el precio base: $${cancha.precio_hora}`,
      data: {
        cancha_id: canchaId,
        configuraciones_eliminadas: deleted,
        precio_base: parseFloat(cancha.precio_hora || 0)
      }
    });

  } catch (error) {
    console.error('Error en deleteAllPrices:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar precios',
      error: error.message
    });
  }
};

// ============================================================
// NUEVAS FUNCIONES PARA SISTEMA DE BLOQUES
// ============================================================

/**
 * MISIÓN 1: GET - OBTENER Y AGRUPAR POR BLOQUES LÓGICOS
 * GET /api/canchas/:id/precios
 * 
 * Obtiene los precios planos de la BD y los agrupa en bloques lógicos.
 * Dos o más días pertenecen al mismo bloque si tienen EXACTAMENTE
 * las mismas franjas horarias con los mismos precios.
 * 
 * Respuesta esperada:
 * {
 *   "cancha_id": 1,
 *   "bloques": [
 *     {
 *       "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
 *       "horarios": [
 *         { "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 50000 },
 *         { "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 80000 }
 *       ]
 *     },
 *     {
 *       "dias": ["Sá", "Do"],
 *       "horarios": [
 *         { "hora_inicio": "09:00", "hora_fin": "22:00", "precio_hora": 90000 }
 *       ]
 *     }
 *   ]
 * }
 */
export const getPreciosBloques = async (req, res) => {
  try {
    const canchaId = parseInt(req.params.id);

    // Validar que cancha_id sea válido
    if (isNaN(canchaId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    // Verificar que la cancha existe
    const cancha = await Canchas.findByPk(canchaId);
    if (!cancha) {
      return res.status(404).json({
        success: false,
        message: 'Cancha no encontrada'
      });
    }

    // Obtener todos los registros de precios para esta cancha
    const registrosPlanos = await CanchaHorariosPrecios.findAll({
      where: { cancha_id: canchaId },
      order: [['tipo_dia', 'ASC'], ['hora_inicio', 'ASC']],
      raw: true
    });

    // Si no hay precios configurados, retornar array vacío
    if (registrosPlanos.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay precios configurados para esta cancha',
        data: {
          cancha_id: canchaId,
          bloques: []
        }
      });
    }

    // ===================================================
    // ALGORITMO DE AGRUPACIÓN POR BLOQUES LÓGICOS
    // ===================================================

    // Paso 1: Agrupar registros por día (tipo_dia)
    const registrosPorDia = {};
    for (const registro of registrosPlanos) {
      const dia = registro.tipo_dia;
      if (!registrosPorDia[dia]) {
        registrosPorDia[dia] = [];
      }
      registrosPorDia[dia].push({
        hora_inicio: normalizarHora(registro.hora_inicio),
        hora_fin: normalizarHora(registro.hora_fin),
        precio_hora: parseFloat(registro.precio_hora)
      });
    }

    // Paso 2: Crear "firma" única para cada conjunto de franjas horarias
    // Dos días con la misma firma tienen las mismas franjas y precios
    const diasConFirma = [];
    for (const [dia, horarios] of Object.entries(registrosPorDia)) {
      // Ordenar franjas para garantizar comparación consistente
      const horariosOrdenados = horarios.sort((a, b) => {
        if (a.hora_inicio !== b.hora_inicio) {
          return a.hora_inicio.localeCompare(b.hora_inicio);
        }
        return a.hora_fin.localeCompare(b.hora_fin);
      });

      // Generar firma única basada en las franjas
      const firma = JSON.stringify(horariosOrdenados);
      
      diasConFirma.push({
        dia: parseInt(dia),
        horarios: horariosOrdenados,
        firma: firma
      });
    }

    // Paso 3: Agrupar días que tienen la misma firma
    const bloquesPorFirma = {};
    for (const item of diasConFirma) {
      if (!bloquesPorFirma[item.firma]) {
        bloquesPorFirma[item.firma] = {
          dias: [],
          horarios: item.horarios
        };
      }
      bloquesPorFirma[item.firma].dias.push(item.dia);
    }

    // Paso 4: Convertir a formato final con etiquetas legibles
    const bloques = ordenarBloquesPorDiaSemana(
      Object.values(bloquesPorFirma).map((bloque) => {
        const diasOrdenados = [...bloque.dias].sort(
          (a, b) => ORDEN_DIAS.indexOf(a) - ORDEN_DIAS.indexOf(b)
        );

        return {
          dias: diasOrdenados.map((dia) => DIA_A_ETIQUETA[dia]),
          horarios: bloque.horarios
        };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Precios obtenidos y agrupados exitosamente',
      data: {
        cancha_id: canchaId,
        bloques: bloques
      }
    });

  } catch (error) {
    console.error('Error en getPreciosBloques:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener precios',
      error: error.message
    });
  }
};

/**
 * MISIÓN 2: PUT/POST - GUARDAR CONFIGURACIÓN (Aplanar y actualizar)
 * PUT /api/canchas/:id/precios
 * 
 * Recibe el array de bloques del frontend y lo aplana para guardarlo en la BD.
 * Toda la operación se ejecuta dentro de una transacción para garantizar consistencia.
 * 
 * Body esperado:
 * {
 *   "bloques": [
 *     {
 *       "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
 *       "horarios": [
 *         { "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 50000 },
 *         { "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 80000 }
 *       ]
 *     },
 *     {
 *       "dias": ["Sá", "Do", "Fes"],
 *       "horarios": [
 *         { "hora_inicio": "09:00", "hora_fin": "22:00", "precio_hora": 90000 }
 *       ]
 *     }
 *   ]
 * }
 */
export const setPreciosBloques = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const canchaId = parseInt(req.params.id);
    const userId = req.user.id;
    const { bloques } = req.body;

    // Validar que cancha_id sea válido
    if (isNaN(canchaId)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'ID de cancha inválido'
      });
    }

    // Verificar que la cancha existe y obtener el complejo
    const cancha = await Canchas.findByPk(canchaId, {
      include: [{
        model: Complejos,
        as: 'complejo',
        attributes: ['id', 'dueño_id']
      }],
      transaction
    });

    if (!cancha) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Cancha no encontrada'
      });
    }

    // Verificar que el usuario es dueño del complejo
    if (cancha.complejo.dueño_id !== userId) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para configurar precios de esta cancha'
      });
    }

    // Validar estructura del body
    if (!Array.isArray(bloques)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'El campo "bloques" debe ser un array'
      });
    }

    // ===================================================
    // VALIDACIÓN DE BLOQUES
    // ===================================================
    for (let i = 0; i < bloques.length; i++) {
      const bloque = bloques[i];

      // Validar estructura del bloque
      if (!bloque.dias || !Array.isArray(bloque.dias) || bloque.dias.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Bloque ${i + 1}: debe contener un array "dias" con al menos un día`
        });
      }

      if (!bloque.horarios || !Array.isArray(bloque.horarios) || bloque.horarios.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Bloque ${i + 1}: debe contener un array "horarios" con al menos una franja`
        });
      }

      // Validar etiquetas de días
      for (const diaEtiqueta of bloque.dias) {
        if (!ETIQUETA_A_DIA.hasOwnProperty(diaEtiqueta)) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Bloque ${i + 1}: etiqueta de día "${diaEtiqueta}" no es válida. Valores permitidos: Lu, Ma, Mi, Ju, Vi, Sá, Do, Fes`
          });
        }
      }

      // Validar cada franja horaria
      for (let j = 0; j < bloque.horarios.length; j++) {
        const franja = bloque.horarios[j];

        if (!franja.hora_inicio || !franja.hora_fin) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Bloque ${i + 1}, Franja ${j + 1}: "hora_inicio" y "hora_fin" son obligatorios`
          });
        }

        // Validar formato de hora (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(franja.hora_inicio)) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Bloque ${i + 1}, Franja ${j + 1}: "hora_inicio" debe estar en formato HH:MM (24 horas)`
          });
        }

        if (!timeRegex.test(franja.hora_fin)) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Bloque ${i + 1}, Franja ${j + 1}: "hora_fin" debe estar en formato HH:MM (24 horas)`
          });
        }

        if (franja.precio_hora === undefined || franja.precio_hora === null) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Bloque ${i + 1}, Franja ${j + 1}: "precio_hora" es obligatorio`
          });
        }

        if (typeof franja.precio_hora !== 'number' || franja.precio_hora < 0) {
          await transaction.rollback();
          return res.status(400).json({
            success: false,
            message: `Bloque ${i + 1}, Franja ${j + 1}: "precio_hora" debe ser un número mayor o igual a 0`
          });
        }
      }
    }

    // ===================================================
    // PASO A: ELIMINAR TODOS LOS REGISTROS EXISTENTES
    // ===================================================
    await CanchaHorariosPrecios.destroy({
      where: { cancha_id: canchaId },
      transaction
    });

    // ===================================================
    // PASO B: APLANAR BLOQUES Y CREAR REGISTROS INDIVIDUALES
    // ===================================================
    const registrosPlanos = [];

    for (const bloque of bloques) {
      // Convertir etiquetas de días a sus IDs numéricos
      const diasNumericos = bloque.dias.map(etiqueta => ETIQUETA_A_DIA[etiqueta]);

      // Para cada día en el bloque
      for (const dia of diasNumericos) {
        // Para cada franja horaria en el bloque
        for (const franja of bloque.horarios) {
          registrosPlanos.push({
            cancha_id: canchaId,
            tipo_dia: dia,
            hora_inicio: franja.hora_inicio,
            hora_fin: franja.hora_fin,
            precio_hora: franja.precio_hora
          });
        }
      }
    }

    // Si hay registros para insertar, hacer bulkCreate
    let preciosCreados = [];
    if (registrosPlanos.length > 0) {
      preciosCreados = await CanchaHorariosPrecios.bulkCreate(
        registrosPlanos,
        { transaction }
      );
    }

    // Confirmar la transacción
    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: 'Precios configurados exitosamente',
      data: {
        cancha_id: canchaId,
        cancha_nombre: cancha.nombre,
        bloques_recibidos: bloques.length,
        registros_creados: preciosCreados.length
      }
    });

  } catch (error) {
    // Revertir transacción en caso de error
    await transaction.rollback();
    
    console.error('Error en setPreciosBloques:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al configurar precios',
      error: error.message
    });
  }
};
