import { Op } from 'sequelize';
import { 
  sequelize, 
  Sequelize,
  Canchas, 
  Reservas, 
  User, 
  Sports,
  CanchaHorariosPrecios,
  ComplejoHorarios,
  UsuarioComplejo
} from '../db/db.js';

/**
 * Controller Dashboard - Zyra
 * Maneja el endpoint inicial del dashboard con lazy loading optimizado
 */

/**
 * GET /api/dashboard/init
 * Endpoint inicial del Dashboard - Trae datos estructurales y métricas del día actual
 * Query params: 
 *  - complejo_id (requerido): ID del complejo
 *  - fecha (opcional): Fecha en formato YYYY-MM-DD (default: fecha actual)
 */
export const getDashboardInit = async (req, res) => {
  try {
    const complejoId = req.complejoId; // Viene del middleware
    const fechaQuery = req.query.fecha;

    // Establecer fecha de consulta (default: 2026-06-12)
    let fechaConsulta;
    if (fechaQuery) {
      // Validar formato de fecha
      const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!fechaRegex.test(fechaQuery)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
      }
      fechaConsulta = fechaQuery;
    } else {
      // Default: 2026-06-12
      fechaConsulta = '2026-06-12';
    }

    // Calcular día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)
    const fechaObj = new Date(fechaConsulta + 'T00:00:00');
    const diaSemana = fechaObj.getDay();

    // ============================================
    // A) OBTENER CANCHAS DEL COMPLEJO
    // ============================================
    const canchas = await Canchas.findAll({
      where: { 
        complejo_id: complejoId,
        state: {
          [Op.notIn]: ['FUERA DE SERVICIO', 'ELIMINADA']
        }
      },
      include: [
        {
          model: Sports,
          as: 'sport',
          attributes: ['id', 'name', 'state']
        }
      ],
      attributes: ['id', 'nombre', 'tipo_deporte', 'sport_id', 'state', 'photo'],
      order: [['id', 'ASC']]
    });

    if (!canchas || canchas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron canchas para este complejo'
      });
    }

    const canchaIds = canchas.map(c => c.id);

    // ============================================
    // B) OBTENER RESERVAS DEL DÍA
    // ============================================
    const reservas = await Reservas.findAll({
      where: {
        cancha_id: {
          [Op.in]: canchaIds
        },
        fecha: fechaConsulta,
        estado_reserva: {
          [Op.notIn]: ['CANCELADA']
        }
      },
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id', 'name', 'nick', 'telefono', 'photo']
        }
      ],
      attributes: [
        'id',
        'cancha_id',
        'fecha',
        'hora_inicio',
        'duracion_minutos',
        'monto_total',
        'monto_abono',
        'estado_pago',
        'estado_reserva',
        'metodo_pago'
      ],
      order: [['hora_inicio', 'ASC']]
    });

    // Formatear reservas con estado de pago legible
    const reservasFormateadas = reservas.map(reserva => {
      let estadoPagoLegible = 'Pendiente por pagar';
      
      if (reserva.estado_pago === 'PAGADA_TOTAL') {
        estadoPagoLegible = 'Pago Confirmado';
      } else if (reserva.estado_pago === 'ABONADA' && reserva.monto_abono > 0) {
        estadoPagoLegible = 'Anticipo recibido';
      }

      // Calcular hora de fin
      const horaInicio = reserva.hora_inicio;
      const duracion = reserva.duracion_minutos;
      const [horas, minutos] = horaInicio.split(':').map(Number);
      const minutosTotal = horas * 60 + minutos + duracion;
      const horaFinHoras = Math.floor(minutosTotal / 60);
      const horaFinMinutos = minutosTotal % 60;
      const horaFin = `${String(horaFinHoras).padStart(2, '0')}:${String(horaFinMinutos).padStart(2, '0')}:00`;

      return {
        id: reserva.id,
        cancha_id: reserva.cancha_id,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        hora_fin: horaFin,
        duracion_minutos: reserva.duracion_minutos,
        monto_total: parseFloat(reserva.monto_total),
        monto_abono: parseFloat(reserva.monto_abono),
        estado_pago: reserva.estado_pago,
        estado_pago_legible: estadoPagoLegible,
        estado_reserva: reserva.estado_reserva,
        metodo_pago: reserva.metodo_pago,
        cliente: {
          id: reserva.usuario?.id || null,
          nombre: reserva.usuario?.name || reserva.usuario?.nick || 'Sin nombre',
          telefono: reserva.usuario?.telefono || null,
          photo: reserva.usuario?.photo || null
        }
      };
    });

    // ============================================
    // C) CALCULAR MÉTRICAS (SUMMARY)
    // ============================================

    // 1. INGRESOS ESTIMADOS DEL DÍA
    // Sumar monto_total de reservas CONFIRMADAS o con ABONO
    const ingresosResult = await Reservas.findOne({
      where: {
        cancha_id: {
          [Op.in]: canchaIds
        },
        fecha: fechaConsulta,
        estado_reserva: 'CONFIRMADA',
        estado_pago: {
          [Op.in]: ['ABONADA', 'PAGADA_TOTAL']
        }
      },
      attributes: [
        [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('monto_total')), 0), 'total_ingresos']
      ],
      raw: true
    });

    const ingresosEstimados = parseFloat(ingresosResult.total_ingresos) || 0;

    // 2. CALCULAR BLOQUES DISPONIBLES Y OCUPACIÓN
    // Obtener horarios del complejo para este día
    const horarioComplejo = await ComplejoHorarios.findOne({
      where: {
        complejo_id: complejoId,
        dia_semana: diaSemana,
        esta_cerrado: false
      }
    });

    let totalBloquesDisponibles = 0;
    let horasDisponibles = 0;
    let ocupacionPorcentaje = 0;
    let horariosOperacion = [];

    if (horarioComplejo) {
      const horaApertura = horarioComplejo.hora_apertura; // Ej: "08:00:00"
      const horaCierre = horarioComplejo.hora_cierre; // Ej: "22:00:00"

      // Convertir horas a minutos
      const [aperturaH, aperturaM] = horaApertura.split(':').map(Number);
      const [cierreH, cierreM] = horaCierre.split(':').map(Number);
      const minApertura = aperturaH * 60 + aperturaM;
      const minCierre = cierreH * 60 + cierreM;
      const minutosOperacion = minCierre - minApertura;

      // Asumir bloques de 60 minutos (1 hora)
      const bloquesOperacion = Math.floor(minutosOperacion / 60);
      
      // Generar array de horarios de operación
      for (let i = 0; i < bloquesOperacion; i++) {
        const minutosBloque = minApertura + (i * 60);
        const horas = Math.floor(minutosBloque / 60);
        const minutos = minutosBloque % 60;
        
        // Formato 24 horas para clave
        const clave = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
        
        // Formato 12 horas para etiqueta
        const hora12 = horas > 12 ? horas - 12 : (horas === 0 ? 12 : horas);
        const periodo = horas >= 12 ? 'PM' : 'AM';
        const etiqueta = `${hora12}:${String(minutos).padStart(2, '0')} ${periodo}`;
        
        horariosOperacion.push({ clave, etiqueta });
      }
      
      // Total de bloques disponibles = bloques por día * número de canchas
      totalBloquesDisponibles = bloquesOperacion * canchas.length;

      // Calcular bloques ocupados (sumar duraciones de reservas en horas)
      let bloquesOcupados = 0;
      reservas.forEach(reserva => {
        const bloquesReserva = Math.ceil(reserva.duracion_minutos / 60);
        bloquesOcupados += bloquesReserva;
      });

      // Calcular porcentaje de ocupación
      if (totalBloquesDisponibles > 0) {
        ocupacionPorcentaje = Math.round((bloquesOcupados / totalBloquesDisponibles) * 100);
      }

      // Horas disponibles = bloques disponibles - bloques ocupados
      horasDisponibles = Math.max(0, totalBloquesDisponibles - bloquesOcupados);
    } else {
      // Si no hay horario configurado, establecer valores por defecto
      horasDisponibles = 0;
      ocupacionPorcentaje = 0;
      horariosOperacion = [];
    }

    // ============================================
    // D) CONSTRUIR RESPUESTA FINAL
    // ============================================
    const response = {
      success: true,
      fecha_consultada: fechaConsulta,
      horarios: horariosOperacion,
      summary: {
        ocupacion_porcentaje: ocupacionPorcentaje,
        horas_disponibles: horasDisponibles,
        ingresos_estimados_cop: ingresosEstimados
      },
      canchas: canchas.map(cancha => ({
        id: cancha.id,
        nombre: cancha.nombre,
        tipo_deporte: cancha.tipo_deporte,
        state: cancha.state,
        photo: cancha.photo,
        sport: {
          id: cancha.sport?.id || null,
          nombre: cancha.sport?.name || cancha.tipo_deporte,
          state: cancha.sport?.state || null
        }
      })),
      reservas: reservasFormateadas
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar el dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/dashboard/:complejoId/:canchaId
 * Detalle de una cancha específica para el panel de control
 * Requiere autenticación + acceso al complejo
 * Query params:
 *  - fecha (opcional): YYYY-MM-DD (default: fecha actual)
 */
export const getDashboardCancha = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.complejoId, 10);
    const canchaId = parseInt(req.params.canchaId, 10);

    console.log(`[getDashboardCancha] complejoId=${complejoId}, canchaId=${canchaId}, fecha=${req.query.fecha ?? 'hoy'}, userId=${req.user?.id}`);

    if (isNaN(complejoId) || isNaN(canchaId)) {
      return res.status(400).json({ success: false, message: 'IDs inválidos' });
    }

    // Verificar acceso del usuario al complejo
    const acceso = await UsuarioComplejo.findOne({
      where: { user_id: req.user.id, complejo_id: complejoId }
    });

    if (!acceso) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este complejo' });
    }

    // Fecha de consulta
    const fechaQuery = req.query.fecha;
    let fechaConsulta;
    if (fechaQuery && /^\d{4}-\d{2}-\d{2}$/.test(fechaQuery)) {
      fechaConsulta = fechaQuery;
    } else {
      const hoy = new Date();
      const y = hoy.getFullYear();
      const m = String(hoy.getMonth() + 1).padStart(2, '0');
      const d = String(hoy.getDate()).padStart(2, '0');
      fechaConsulta = `${y}-${m}-${d}`;
    }

    // Obtener cancha (verificando que pertenece al complejo)
    const cancha = await Canchas.findOne({
      where: { id: canchaId, complejo_id: complejoId },
      include: [
        { model: Sports, as: 'sport', attributes: ['id', 'name', 'state'] }
      ],
      attributes: ['id', 'nombre', 'tipo_deporte', 'sport_id', 'state', 'photo', 'precio_hora']
    });

    if (!cancha) {
      return res.status(404).json({ success: false, message: 'Cancha no encontrada en este complejo' });
    }

    // Reservas del día para esta cancha
    const reservas = await Reservas.findAll({
      where: {
        cancha_id: canchaId,
        fecha: fechaConsulta,
        estado_reserva: { [Op.notIn]: ['CANCELADA'] }
      },
      include: [
        { model: User, as: 'usuario', attributes: ['id', 'name', 'nick', 'telefono', 'photo'] }
      ],
      attributes: [
        'id', 'cancha_id', 'fecha', 'hora_inicio', 'duracion_minutos',
        'monto_total', 'monto_abono', 'estado_pago', 'estado_reserva', 'metodo_pago'
      ],
      order: [['hora_inicio', 'ASC']]
    });

    const reservasFormateadas = reservas.map(reserva => {
      if (!reserva.hora_inicio) {
        console.warn(`[getDashboardCancha] Reserva ${reserva.id} sin hora_inicio, se omite`);
        return null;
      }

      let estadoPagoLegible = 'Pendiente por pagar';
      if (reserva.estado_pago === 'PAGADA_TOTAL') estadoPagoLegible = 'Pago Confirmado';
      else if (reserva.estado_pago === 'ABONADA' && reserva.monto_abono > 0) estadoPagoLegible = 'Anticipo recibido';

      const partes = reserva.hora_inicio.split(':').map(Number);
      const horas = partes[0] ?? 0;
      const minutos = partes[1] ?? 0;
      const minutosTotal = horas * 60 + minutos + (reserva.duracion_minutos ?? 60);
      const horaFin = `${String(Math.floor(minutosTotal / 60)).padStart(2, '0')}:${String(minutosTotal % 60).padStart(2, '0')}:00`;

      return {
        id: reserva.id,
        cancha_id: reserva.cancha_id,
        fecha: reserva.fecha,
        hora_inicio: reserva.hora_inicio,
        hora_fin: horaFin,
        duracion_minutos: reserva.duracion_minutos ?? 60,
        monto_total: parseFloat(reserva.monto_total) || 0,
        monto_abono: parseFloat(reserva.monto_abono) || 0,
        estado_pago: reserva.estado_pago,
        estado_pago_legible: estadoPagoLegible,
        estado_reserva: reserva.estado_reserva,
        metodo_pago: reserva.metodo_pago,
        cliente: {
          id: reserva.usuario?.id || null,
          nombre: reserva.usuario?.name || reserva.usuario?.nick || 'Sin nombre',
          telefono: reserva.usuario?.telefono || null,
          photo: reserva.usuario?.photo || null
        }
      };
    }).filter(Boolean);

    // Precios de la cancha (tipo_dia = 0-7, hora_inicio/hora_fin)
    const precios = await CanchaHorariosPrecios.findAll({
      where: { cancha_id: canchaId },
      order: [['tipo_dia', 'ASC'], ['hora_inicio', 'ASC']]
    });

    // ============================================
    // CALCULAR MÉTRICAS Y HORARIOS DE OPERACIÓN
    // ============================================
    const fechaObj = new Date(fechaConsulta + 'T00:00:00');
    const diaSemana = fechaObj.getDay(); // 0=Dom, 1=Lun, ... 6=Sáb

    const horarioComplejo = await ComplejoHorarios.findOne({
      where: { complejo_id: complejoId, dia_semana: diaSemana, esta_cerrado: false }
    });

    let horariosOperacion = [];
    let ocupacionPorcentaje = 0;
    let horasDisponibles = 0;
    let ingresosEstimados = 0;

    if (horarioComplejo && horarioComplejo.hora_apertura && horarioComplejo.hora_cierre) {
      const aperturaPartes = horarioComplejo.hora_apertura.split(':').map(Number);
      const cierrePartes = horarioComplejo.hora_cierre.split(':').map(Number);
      const [aperturaH, aperturaM] = aperturaPartes;
      const [cierreH, cierreM] = cierrePartes;
      const minApertura = aperturaH * 60 + aperturaM;
      const minCierre = cierreH * 60 + cierreM;
      const bloquesOperacion = Math.floor((minCierre - minApertura) / 60);

      for (let i = 0; i < bloquesOperacion; i++) {
        const minBloque = minApertura + i * 60;
        const h = Math.floor(minBloque / 60);
        const m = minBloque % 60;
        const clave = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const periodo = h >= 12 ? 'PM' : 'AM';
        const etiqueta = `${h12}:${String(m).padStart(2, '0')} ${periodo}`;
        horariosOperacion.push({ clave, etiqueta });
      }

      // Calcular bloques ocupados (1 bloque = 1 hora)
      let bloquesOcupados = 0;
      reservasFormateadas.forEach(r => {
        bloquesOcupados += Math.ceil(r.duracion_minutos / 60);
      });

      if (bloquesOperacion > 0) {
        ocupacionPorcentaje = Math.round((bloquesOcupados / bloquesOperacion) * 100);
      }
      horasDisponibles = Math.max(0, bloquesOperacion - bloquesOcupados);

      // Ingresos: suma de montos de reservas confirmadas con pago (abono o total)
      ingresosEstimados = reservasFormateadas
        .filter(r => r.estado_reserva === 'CONFIRMADA' &&
          (r.estado_pago === 'ABONADA' || r.estado_pago === 'PAGADA_TOTAL'))
        .reduce((acc, r) => acc + r.monto_total, 0);
    }

    // ================================================
    // RESERVAS DE LA SEMANA (para tab Reservas)
    // Lunes a Domingo de la semana actual (basado en fecha real, no fechaConsulta)
    // ================================================
    const fmtDate = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const hoyReal = new Date();
    const diaReal = hoyReal.getDay();
    const offsetLunes = diaReal === 0 ? -6 : 1 - diaReal;
    const lunesSemana = new Date(hoyReal);
    lunesSemana.setDate(hoyReal.getDate() + offsetLunes);
    lunesSemana.setHours(0, 0, 0, 0);
    const domingoSemana = new Date(lunesSemana);
    domingoSemana.setDate(lunesSemana.getDate() + 6);
    domingoSemana.setHours(23, 59, 59, 999);

    const fechaInicioSemana = fmtDate(lunesSemana);
    const fechaFinSemana = fmtDate(domingoSemana);

    const reservasSemanaDB = await Reservas.findAll({
      where: {
        cancha_id: canchaId,
        fecha: { [Op.between]: [fechaInicioSemana, fechaFinSemana] },
        estado_reserva: { [Op.notIn]: ['CANCELADA'] }
      },
      include: [{ model: User, as: 'usuario', attributes: ['id', 'name', 'nick', 'telefono'] }],
      attributes: [
        'id', 'fecha', 'hora_inicio', 'duracion_minutos', 'monto_total', 'monto_abono',
        'estado_pago', 'estado_reserva', 'metodo_pago', 'origen_reserva',
        'telefono_contacto', 'nombre_contacto'
      ],
      order: [['fecha', 'ASC'], ['hora_inicio', 'ASC']]
    });

    // Horarios del complejo para todos los días (para calcular ocupación semanal)
    const horariosSemanales = await ComplejoHorarios.findAll({
      where: { complejo_id: complejoId, esta_cerrado: false }
    });
    const horariosPorDiaSemana = {};
    horariosSemanales.forEach(h => { horariosPorDiaSemana[h.dia_semana] = h; });

    // Tendencia Lun-Dom
    const LABELS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    let totalHorasSemana = 0;
    const tendenciaSemana = LABELS_SEMANA.map((etiqueta, i) => {
      const dia = new Date(lunesSemana);
      dia.setDate(lunesSemana.getDate() + i);
      const diaStr = fmtDate(dia);
      const diaNum = dia.getDay();
      const hd = horariosPorDiaSemana[diaNum];
      const rdDia = reservasSemanaDB.filter(r => String(r.fecha).slice(0, 10) === diaStr);

      let ocupacion = 0;
      if (hd && hd.hora_apertura && hd.hora_cierre) {
        const ap = hd.hora_apertura.split(':').map(Number);
        const ci = hd.hora_cierre.split(':').map(Number);
        const bloquesDisp = Math.floor(((ci[0] * 60 + ci[1]) - (ap[0] * 60 + ap[1])) / 60);
        const bloquesOcup = rdDia.reduce((acc, r) => acc + Math.ceil((r.duracion_minutos || 60) / 60), 0);
        if (bloquesDisp > 0) ocupacion = Math.min(100, Math.round((bloquesOcup / bloquesDisp) * 100));
        totalHorasSemana += bloquesOcup;
      }
      return { etiqueta, ocupacion };
    });

    // Bloques horarios más frecuentes de la semana
    const bloquesMapSemana = {};
    reservasSemanaDB.forEach(r => {
      if (!r.hora_inicio) return;
      const h = parseInt(r.hora_inicio.split(':')[0], 10);
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const clave = `${h12} ${h >= 12 ? 'PM' : 'AM'}`;
      bloquesMapSemana[clave] = (bloquesMapSemana[clave] || 0) + 1;
    });
    const bloquesSemana = Object.entries(bloquesMapSemana)
      .map(([hora, cnt]) => ({ hora, reservas: cnt }))
      .sort((a, b) => {
        const toH = (s) => {
          const [n, p] = s.split(' ');
          const hh = parseInt(n, 10);
          return p === 'PM' ? (hh === 12 ? 12 : hh + 12) : (hh === 12 ? 0 : hh);
        };
        return toH(a.hora) - toH(b.hora);
      });

    // Formatear reservas de la semana
    const reservasSemanaFormateadas = reservasSemanaDB.map(r => ({
      id: r.id,
      fecha: String(r.fecha).slice(0, 10),
      hora_inicio: r.hora_inicio,
      duracion_minutos: r.duracion_minutos ?? 60,
      monto_total: parseFloat(r.monto_total) || 0,
      monto_abono: parseFloat(r.monto_abono) || 0,
      estado_pago: r.estado_pago,
      estado_reserva: r.estado_reserva,
      metodo_pago: r.metodo_pago,
      origen_reserva: r.origen_reserva,
      cliente: {
        id: r.usuario?.id || null,
        nombre: r.usuario?.name || r.usuario?.nick || r.nombre_contacto || 'Sin nombre',
        telefono: r.usuario?.telefono || r.telefono_contacto || null
      }
    }));

    res.status(200).json({
      success: true,
      fecha_consultada: fechaConsulta,
      horarios: horariosOperacion,
      summary: {
        ocupacion_porcentaje: ocupacionPorcentaje,
        horas_disponibles: horasDisponibles,
        ingresos_estimados_cop: ingresosEstimados
      },
      cancha: {
        id: cancha.id,
        nombre: cancha.nombre,
        tipo_deporte: cancha.tipo_deporte,
        state: cancha.state,
        photo: cancha.photo,
        precio_hora: cancha.precio_hora ? parseFloat(cancha.precio_hora) : null,
        sport: {
          id: cancha.sport?.id || null,
          nombre: cancha.sport?.name || cancha.tipo_deporte,
          state: cancha.sport?.state || null
        }
      },
      reservas: reservasFormateadas,
      precios: precios.map(p => p.toJSON()),
      reservas_semana: {
        fecha_inicio: fechaInicioSemana,
        fecha_fin: fechaFinSemana,
        reservas: reservasSemanaFormateadas,
        analytics: {
          totalHoras: totalHorasSemana,
          tendencia: tendenciaSemana,
          bloques: bloquesSemana
        }
      }
    });

  } catch (error) {
    console.error('[getDashboardCancha] ERROR:', error.message);
    console.error('[getDashboardCancha] STACK:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error al cargar el detalle de la cancha',
      error: error.message
    });
  }
};

/**
 * GET /api/dashboard/:complejoId/:canchaId/reservas?rango=30dias|mes
 * Reservas extendidas + analytics de ocupación para el tab Reservas
 */
export const getCanchaReservas = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.complejoId, 10);
    const canchaId = parseInt(req.params.canchaId, 10);
    const rango = req.query.rango || '30dias';

    if (!['30dias', 'mes'].includes(rango)) {
      return res.status(400).json({ success: false, message: 'Rango inválido. Use: 30dias o mes' });
    }

    const acceso = await UsuarioComplejo.findOne({ where: { user_id: req.user.id, complejo_id: complejoId } });
    if (!acceso) return res.status(403).json({ success: false, message: 'Sin acceso a este complejo' });

    const cancha = await Canchas.findOne({ where: { id: canchaId, complejo_id: complejoId }, attributes: ['id'] });
    if (!cancha) return res.status(404).json({ success: false, message: 'Cancha no encontrada' });

    const fmt = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const hoy = new Date();
    let fechaInicio, fechaFin;

    if (rango === '30dias') {
      const inicio = new Date(hoy);
      inicio.setDate(hoy.getDate() - 29);
      inicio.setHours(0, 0, 0, 0);
      fechaInicio = fmt(inicio);
      fechaFin = fmt(hoy);
    } else {
      fechaInicio = fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
      fechaFin = fmt(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
    }

    const reservasDB = await Reservas.findAll({
      where: {
        cancha_id: canchaId,
        fecha: { [Op.between]: [fechaInicio, fechaFin] },
        estado_reserva: { [Op.notIn]: ['CANCELADA'] }
      },
      include: [{ model: User, as: 'usuario', attributes: ['id', 'name', 'nick', 'telefono'] }],
      attributes: [
        'id', 'fecha', 'hora_inicio', 'duracion_minutos', 'monto_total', 'monto_abono',
        'estado_pago', 'estado_reserva', 'metodo_pago', 'origen_reserva',
        'telefono_contacto', 'nombre_contacto'
      ],
      order: [['fecha', 'ASC'], ['hora_inicio', 'ASC']]
    });

    const horariosDB = await ComplejoHorarios.findAll({ where: { complejo_id: complejoId, esta_cerrado: false } });
    const horariosPorDia = {};
    horariosDB.forEach(h => { horariosPorDia[h.dia_semana] = h; });

    const reservasFormateadas = reservasDB.map(r => ({
      id: r.id,
      fecha: String(r.fecha).slice(0, 10),
      hora_inicio: r.hora_inicio,
      duracion_minutos: r.duracion_minutos ?? 60,
      monto_total: parseFloat(r.monto_total) || 0,
      monto_abono: parseFloat(r.monto_abono) || 0,
      estado_pago: r.estado_pago,
      estado_reserva: r.estado_reserva,
      metodo_pago: r.metodo_pago,
      origen_reserva: r.origen_reserva,
      cliente: {
        id: r.usuario?.id || null,
        nombre: r.usuario?.name || r.usuario?.nick || r.nombre_contacto || 'Sin nombre',
        telefono: r.usuario?.telefono || r.telefono_contacto || null
      }
    }));

    // Función auxiliar: calcular ocupación en un rango de fechas
    const calcularSegmento = (inicioStr, finStr) => {
      const [iy, im, id] = inicioStr.split('-').map(Number);
      const [fy, fm, fd] = finStr.split('-').map(Number);
      const cursor = new Date(iy, im - 1, id);
      const fin = new Date(fy, fm - 1, fd);
      let horasReservadas = 0;
      let bloquesPosibles = 0;

      while (cursor <= fin) {
        const dStr = fmt(cursor);
        const hd = horariosPorDia[cursor.getDay()];
        if (hd && hd.hora_apertura && hd.hora_cierre) {
          const ap = hd.hora_apertura.split(':').map(Number);
          const ci = hd.hora_cierre.split(':').map(Number);
          bloquesPosibles += Math.floor(((ci[0] * 60 + ci[1]) - (ap[0] * 60 + ap[1])) / 60);
        }
        const rdDia = reservasFormateadas.filter(r => r.fecha === dStr);
        horasReservadas += rdDia.reduce((acc, r) => acc + Math.ceil(r.duracion_minutos / 60), 0);
        cursor.setDate(cursor.getDate() + 1);
      }
      return {
        horasReservadas,
        ocupacion: bloquesPosibles > 0 ? Math.min(100, Math.round((horasReservadas / bloquesPosibles) * 100)) : 0
      };
    };

    let tendencia = [];
    let totalHoras = 0;

    if (rango === '30dias') {
      const [iy, im, id] = fechaInicio.split('-').map(Number);
      const base = new Date(iy, im - 1, id);
      for (let s = 0; s < 4; s++) {
        const segInicio = new Date(base);
        segInicio.setDate(base.getDate() + s * 7);
        const segFin = new Date(segInicio);
        segFin.setDate(segInicio.getDate() + 6);
        const { horasReservadas, ocupacion } = calcularSegmento(fmt(segInicio), fmt(segFin));
        totalHoras += horasReservadas;
        tendencia.push({ etiqueta: `S${s + 1}`, ocupacion });
      }
    } else {
      // Semanas dentro del mes
      const [iy, im] = fechaInicio.split('-').map(Number);
      const inicioMes = new Date(iy, im - 1, 1);
      const finMes = new Date(iy, im, 0);
      const primerLunes = new Date(inicioMes);
      while (primerLunes.getDay() !== 1) primerLunes.setDate(primerLunes.getDate() - 1);

      let semNum = 1;
      const cursor = new Date(primerLunes);
      while (cursor <= finMes) {
        const semInicio = new Date(Math.max(cursor.getTime(), inicioMes.getTime()));
        const semFin = new Date(cursor);
        semFin.setDate(cursor.getDate() + 6);
        const semFinClipped = new Date(Math.min(semFin.getTime(), finMes.getTime()));
        const { horasReservadas, ocupacion } = calcularSegmento(fmt(semInicio), fmt(semFinClipped));
        totalHoras += horasReservadas;
        tendencia.push({ etiqueta: `Sem ${semNum++}`, ocupacion });
        cursor.setDate(cursor.getDate() + 7);
      }
    }

    // Bloques horarios
    const bloquesMap = {};
    reservasFormateadas.forEach(r => {
      if (!r.hora_inicio) return;
      const h = parseInt(r.hora_inicio.split(':')[0], 10);
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const clave = `${h12} ${h >= 12 ? 'PM' : 'AM'}`;
      bloquesMap[clave] = (bloquesMap[clave] || 0) + 1;
    });
    const bloques = Object.entries(bloquesMap)
      .map(([hora, cnt]) => ({ hora, reservas: cnt }))
      .sort((a, b) => {
        const toH = (s) => {
          const [n, p] = s.split(' ');
          const hh = parseInt(n, 10);
          return p === 'PM' ? (hh === 12 ? 12 : hh + 12) : (hh === 12 ? 0 : hh);
        };
        return toH(a.hora) - toH(b.hora);
      });

    res.status(200).json({
      success: true,
      rango,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      reservas: reservasFormateadas,
      analytics: { totalHoras, tendencia, bloques }
    });

  } catch (error) {
    console.error('[getCanchaReservas] ERROR:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Error al cargar reservas', error: error.message });
  }
};
