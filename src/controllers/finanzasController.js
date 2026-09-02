import { Op } from 'sequelize';
import {
  sequelize,
  Reservas,
  Canchas,
  User,
  ComplejoHorarios,
  UsuarioComplejo,
  Sports,
} from '../db/db.js';

const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PERIODOS_GRANULARIDAD_MES = new Set([
  'ultimos-3-meses',
  'ultimos-6-meses',
  'rango-personalizado',
]);

const resolverGranularidadTendencia = (periodo) =>
  PERIODOS_GRANULARIDAD_MES.has(periodo) ? 'mes' : 'dia';

const MONTO_INGRESO = `
  CASE
    WHEN "reservas"."estado_pago" = 'PAGADA_TOTAL' THEN "reservas"."monto_total"
    WHEN "reservas"."estado_pago" = 'ABONADA' THEN "reservas"."monto_abono"
    ELSE 0
  END
`;

const fmtDate = (fecha) => {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const resolverRangoFechas = (periodo, fechaDesdeQuery, fechaHastaQuery) => {
  if (fechaDesdeQuery && fechaHastaQuery) {
    return { fechaDesde: fechaDesdeQuery, fechaHasta: fechaHastaQuery, periodo: 'personalizado' };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const periodos = {
    'esta-semana': () => {
      const dia = hoy.getDay();
      const offsetLunes = dia === 0 ? -6 : 1 - dia;
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() + offsetLunes);
      const domingo = new Date(lunes);
      domingo.setDate(lunes.getDate() + 6);
      return { fechaDesde: fmtDate(lunes), fechaHasta: fmtDate(domingo) };
    },
    'ultimo-mes': () => {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { fechaDesde: fmtDate(inicio), fechaHasta: fmtDate(hoy) };
    },
    'ultimos-3-meses': () => {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
      return { fechaDesde: fmtDate(inicio), fechaHasta: fmtDate(hoy) };
    },
    'ultimos-6-meses': () => {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
      return { fechaDesde: fmtDate(inicio), fechaHasta: fmtDate(hoy) };
    },
    'rango-personalizado': () => {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      return { fechaDesde: fmtDate(inicio), fechaHasta: fmtDate(hoy) };
    },
  };

  const resolver = periodos[periodo] ?? periodos['esta-semana'];
  const rango = resolver();
  return { ...rango, periodo: periodo ?? 'esta-semana' };
};

const whereReservasActivas = (canchaIds, fechaDesde, fechaHasta, canchaIdFiltro) => {
  const ids = canchaIdFiltro ? [canchaIdFiltro] : canchaIds;

  return {
    cancha_id: { [Op.in]: ids },
    fecha: { [Op.between]: [fechaDesde, fechaHasta] },
    estado_pago: { [Op.in]: ['ABONADA', 'PAGADA_TOTAL'] },
    estado_reserva: { [Op.notIn]: ['CANCELADA'] },
  };
};

const calcularMontoReserva = (reserva) => {
  if (reserva.estado_pago === 'PAGADA_TOTAL') return parseFloat(reserva.monto_total) || 0;
  if (reserva.estado_pago === 'ABONADA') return parseFloat(reserva.monto_abono) || 0;
  return 0;
};

const formatearFechaLegible = (fechaStr) => {
  const hoy = fmtDate(new Date());
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = fmtDate(ayer);

  if (fechaStr === hoy) return 'Hoy';
  if (fechaStr === ayerStr) return 'Ayer';

  const [y, m, d] = fechaStr.split('-').map(Number);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${d} ${meses[m - 1]}`;
};

const etiquetaMetodoPago = (metodo) => {
  const mapa = {
    EFECTIVO: 'Efectivo',
    PAGOS_APP: 'Pago App',
    NEQUI: 'Nequi',
    TRANSFERENCIA: 'Transferencia',
    TARJETA: 'Tarjeta',
  };
  return mapa[metodo] ?? metodo ?? 'Sin método';
};

const METODOS_PAGO_META = {
  EFECTIVO: { label: 'Efectivo', color: '#fbbf24' },
  PAGOS_APP: { label: 'Zyra App', color: '#00B488' },
  NEQUI: { label: 'Nequi', color: '#a855f7' },
  TRANSFERENCIA: { label: 'Transferencia', color: '#3b82f6' },
  TARJETA: { label: 'Tarjeta', color: '#f472b6' },
  OTROS: { label: 'Otros', color: '#64748b' },
};

const normalizarMetodoPagoId = (metodo) => {
  if (!metodo || !String(metodo).trim()) return 'OTROS';
  const id = String(metodo).trim().toUpperCase();
  return METODOS_PAGO_META[id] ? id : id;
};

const metaMetodoPago = (id) =>
  METODOS_PAGO_META[id] ?? {
    label: String(id).replace(/_/g, ' '),
    color: '#94a3b8',
  };

const atributosTendenciaPorMetodo = (granularidad) => {
  const sumMonto = [sequelize.fn('SUM', sequelize.literal(MONTO_INGRESO)), 'monto'];

  if (granularidad === 'mes') {
    const mesKey = sequelize.literal(`TO_CHAR("reservas"."fecha", 'YYYY-MM')`);
    return {
      attributes: [[mesKey, 'mes_key'], 'metodo_pago', sumMonto],
      group: [mesKey, 'metodo_pago'],
      order: [[mesKey, 'ASC']],
    };
  }

  return {
    attributes: ['fecha', 'metodo_pago', sumMonto],
    group: ['fecha', 'metodo_pago'],
    order: [['fecha', 'ASC']],
  };
};

const enriquecerTendenciaConMetodos = (buckets, filasPorMetodo, granularidad) => {
  const mapa = {};

  filasPorMetodo.forEach((fila) => {
    const clave = String(fila.mes_key ?? fila.fecha ?? '').slice(0, granularidad === 'mes' ? 7 : 10);
    const metodo = normalizarMetodoPagoId(fila.metodo_pago);
    if (!mapa[clave]) mapa[clave] = {};
    mapa[clave][metodo] = (mapa[clave][metodo] || 0) + parseFloat(fila.monto ?? 0);
  });

  return buckets.map((bucket) => {
    const porMetodo = mapa[bucket.fecha] ?? {};
    const ingresos = Object.values(porMetodo).reduce((acc, val) => acc + val, 0);

    return {
      ...bucket,
      por_metodo: porMetodo,
      ingresos: ingresos || bucket.ingresos,
      monto: ingresos || bucket.monto,
      efectivo: porMetodo.EFECTIVO ?? bucket.efectivo ?? 0,
      pagos_app: porMetodo.PAGOS_APP ?? bucket.pagos_app ?? 0,
    };
  });
};

const construirResumenMetodosPago = (filasTotalesPorMetodo) => {
  const acumulado = {};

  filasTotalesPorMetodo.forEach((fila) => {
    const id = normalizarMetodoPagoId(fila.metodo_pago);
    acumulado[id] = (acumulado[id] || 0) + parseFloat(fila.monto ?? 0);
  });

  const metodos = Object.entries(acumulado)
    .map(([id, monto]) => ({
      id,
      ...metaMetodoPago(id),
      monto,
    }))
    .sort((a, b) => b.monto - a.monto);

  const idsCatalogo = new Set([
    ...Object.keys(METODOS_PAGO_META),
    ...metodos.map((m) => m.id),
  ]);

  const catalogo = Array.from(idsCatalogo).map((id) => ({
    id,
    ...metaMetodoPago(id),
  }));

  return { metodos, catalogo };
};

const calcularBloquesHorario = (horaApertura, horaCierre) => {
  if (!horaApertura || !horaCierre) return 0;
  const [apH, apM] = String(horaApertura).split(':').map(Number);
  const [ciH, ciM] = String(horaCierre).split(':').map(Number);
  return Math.max(0, Math.floor(((ciH * 60 + ciM) - (apH * 60 + apM)) / 60));
};

const BLOQUES_DIA_DEFAULT = 14;

const whereOcupacionCanchas = (canchaIds, fechaDesde, fechaHasta, canchaIdFiltro) => {
  const ids = canchaIdFiltro ? [canchaIdFiltro] : canchaIds;
  return {
    cancha_id: { [Op.in]: ids },
    fecha: { [Op.between]: [fechaDesde, fechaHasta] },
    estado_reserva: { [Op.notIn]: ['CANCELADA'] },
  };
};

const calcularMetricasOcupacion = (
  canchasActivas,
  fechaDesde,
  fechaHasta,
  horarios,
  reservasOcupacion
) => {
  const canchaIds = canchasActivas.map((c) => c.id);
  if (!canchaIds.length) {
    return { porcentaje: 0, bloques_ocupados: 0, bloques_disponibles: 0, por_cancha: [] };
  }

  const horariosPorDia = Object.fromEntries(horarios.map((h) => [h.dia_semana, h]));
  const usarHorarioDefault = horarios.length === 0;

  const bloquesDisponiblesPorCancha = Object.fromEntries(canchaIds.map((id) => [id, 0]));
  const bloquesOcupadosPorCancha = Object.fromEntries(canchaIds.map((id) => [id, 0]));

  const [yI, mI, dI] = fechaDesde.split('-').map(Number);
  const [yF, mF, dF] = fechaHasta.split('-').map(Number);
  const cursor = new Date(yI, mI - 1, dI);
  const fin = new Date(yF, mF - 1, dF);

  while (cursor <= fin) {
    let bloquesDia = 0;

    if (usarHorarioDefault) {
      bloquesDia = BLOQUES_DIA_DEFAULT;
    } else {
      const hd = horariosPorDia[cursor.getDay()];
      if (hd && !hd.esta_cerrado) {
        bloquesDia = calcularBloquesHorario(hd.hora_apertura, hd.hora_cierre);
      }
    }

    if (bloquesDia > 0) {
      canchaIds.forEach((id) => {
        bloquesDisponiblesPorCancha[id] += bloquesDia;
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  reservasOcupacion.forEach((reserva) => {
    const canchaId = reserva.cancha_id;
    if (bloquesOcupadosPorCancha[canchaId] === undefined) return;
    bloquesOcupadosPorCancha[canchaId] += Math.ceil((reserva.duracion_minutos || 60) / 60);
  });

  const nombresPorId = Object.fromEntries(canchasActivas.map((c) => [c.id, c.nombre]));

  const porCancha = canchaIds.map((id) => {
    const bloquesDisponibles = bloquesDisponiblesPorCancha[id] || 0;
    const bloquesOcupados = bloquesOcupadosPorCancha[id] || 0;
    const porcentaje =
      bloquesDisponibles > 0
        ? Math.min(100, Math.round((bloquesOcupados / bloquesDisponibles) * 100))
        : 0;

    return {
      id,
      nombre: nombresPorId[id] ?? `Cancha ${id}`,
      bloques_ocupados: bloquesOcupados,
      bloques_disponibles: bloquesDisponibles,
      porcentaje,
    };
  });

  const bloquesDisponibles = Object.values(bloquesDisponiblesPorCancha).reduce((a, b) => a + b, 0);
  const bloquesOcupados = Object.values(bloquesOcupadosPorCancha).reduce((a, b) => a + b, 0);
  const porcentaje =
    bloquesDisponibles > 0
      ? Math.min(100, Math.round((bloquesOcupados / bloquesDisponibles) * 100))
      : 0;

  return {
    porcentaje,
    bloques_ocupados: bloquesOcupados,
    bloques_disponibles: bloquesDisponibles,
    por_cancha: porCancha,
    usa_horario_default: usarHorarioDefault,
  };
};

const generarBucketsTendencia = (fechaDesde, fechaHasta, periodo, filasDiarias) => {
  const mapa = Object.fromEntries(
    filasDiarias.map((f) => [String(f.fecha).slice(0, 10), f])
  );

  const [yI, mI, dI] = fechaDesde.split('-').map(Number);
  const [yF, mF, dF] = fechaHasta.split('-').map(Number);
  const cursor = new Date(yI, mI - 1, dI);
  const fin = new Date(yF, mF - 1, dF);

  const usarNombreDia = periodo === 'esta-semana';
  const buckets = [];

  while (cursor <= fin) {
    const key = fmtDate(cursor);
    const fila = mapa[key];
    const ingresos = parseFloat(fila?.ingresos ?? 0);
    const efectivo = parseFloat(fila?.efectivo ?? 0);
    const pagosApp = parseFloat(fila?.pagos_app ?? 0);

    buckets.push({
      fecha: key,
      etiqueta: usarNombreDia ? NOMBRES_DIA[cursor.getDay()] : String(cursor.getDate()),
      ingresos,
      efectivo,
      pagos_app: pagosApp,
      monto: ingresos,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
};

const generarBucketsTendenciaMensual = (fechaDesde, fechaHasta, filasMensuales) => {
  const mapa = Object.fromEntries(
    filasMensuales.map((f) => [String(f.mes_key ?? f.mes).slice(0, 7), f])
  );

  const [yI, mI] = fechaDesde.split('-').map(Number);
  const [yF, mF] = fechaHasta.split('-').map(Number);
  const cursor = new Date(yI, mI - 1, 1);
  const fin = new Date(yF, mF - 1, 1);
  const buckets = [];

  while (cursor <= fin) {
    const mesKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const fila = mapa[mesKey];
    const ingresos = parseFloat(fila?.ingresos ?? 0);
    const efectivo = parseFloat(fila?.efectivo ?? 0);
    const pagosApp = parseFloat(fila?.pagos_app ?? 0);

    buckets.push({
      fecha: mesKey,
      etiqueta: MESES_CORTOS[cursor.getMonth()],
      ingresos,
      efectivo,
      pagos_app: pagosApp,
      monto: ingresos,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
};

const construirTendenciaDesdeFilas = (fechaDesde, fechaHasta, periodo, filas) => {
  const granularidad = resolverGranularidadTendencia(periodo);
  if (granularidad === 'mes') {
    return {
      granularidad,
      buckets: generarBucketsTendenciaMensual(fechaDesde, fechaHasta, filas),
    };
  }
  return {
    granularidad,
    buckets: generarBucketsTendencia(fechaDesde, fechaHasta, periodo, filas),
  };
};

const atributosTendencia = (granularidad) => {
  const sumIngresos = [sequelize.fn('SUM', sequelize.literal(MONTO_INGRESO)), 'ingresos'];
  const sumEfectivo = [
    sequelize.fn(
      'SUM',
      sequelize.literal(
        `CASE WHEN "reservas"."metodo_pago" = 'EFECTIVO' THEN ${MONTO_INGRESO} ELSE 0 END`
      )
    ),
    'efectivo',
  ];
  const sumPagosApp = [
    sequelize.fn(
      'SUM',
      sequelize.literal(
        `CASE WHEN "reservas"."metodo_pago" = 'PAGOS_APP' THEN ${MONTO_INGRESO} ELSE 0 END`
      )
    ),
    'pagos_app',
  ];

  if (granularidad === 'mes') {
    const mesKey = sequelize.literal(`TO_CHAR("reservas"."fecha", 'YYYY-MM')`);
    return {
      attributes: [[mesKey, 'mes_key'], sumIngresos, sumEfectivo, sumPagosApp],
      group: [mesKey],
      order: [[mesKey, 'ASC']],
    };
  }

  return {
    attributes: ['fecha', sumIngresos, sumEfectivo, sumPagosApp],
    group: ['fecha'],
    order: [['fecha', 'ASC']],
  };
};

const CANCHAS_ACTIVAS_WHERE = (complejoId) => ({
  complejo_id: complejoId,
  state: { [Op.notIn]: ['FUERA DE SERVICIO', 'ELIMINADA'] },
});

const resolverDeporteClave = (cancha) => {
  const sportId = cancha.sport_id ?? cancha.sport?.id ?? null;
  if (sportId) return `sport:${sportId}`;
  const nombre = (cancha.tipo_deporte || cancha.sport?.name || '').trim();
  return nombre ? `tipo:${nombre.toLowerCase()}` : null;
};

const construirCatalogoFiltros = (canchasCatalogo) => {
  const deportesMap = new Map();

  canchasCatalogo.forEach((cancha) => {
    const clave = resolverDeporteClave(cancha);
    const nombre = (cancha.sport?.name || cancha.tipo_deporte || '').trim();
    if (!clave || !nombre) return;

    if (!deportesMap.has(clave)) {
      deportesMap.set(clave, {
        clave,
        id: cancha.sport_id ?? cancha.sport?.id ?? null,
        nombre,
      });
    }
  });

  return {
    canchas: canchasCatalogo.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      sport_id: c.sport_id ?? c.sport?.id ?? null,
      tipo_deporte: c.tipo_deporte ?? c.sport?.name ?? null,
      deporte_clave: resolverDeporteClave(c),
    })),
    deportes: Array.from(deportesMap.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es')
    ),
  };
};

const filtrarCanchasParaConsulta = (canchasCatalogo, { deporteClave, canchaIdFiltro }) =>
  canchasCatalogo.filter((c) => {
    if (canchaIdFiltro && c.id !== canchaIdFiltro) return false;
    if (deporteClave && resolverDeporteClave(c) !== deporteClave) return false;
    return true;
  });

const respuestaVaciaFinanzas = (fechaDesde, fechaHasta, periodo, filtros) => {
  const { granularidad, buckets } = construirTendenciaDesdeFilas(fechaDesde, fechaHasta, periodo, []);
  return {
    success: true,
    periodo: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, clave: periodo },
    tendencia_granularidad: granularidad,
    kpis: { ingresos_totales: 0, efectivo_caja: 0, recaudado_zyra: 0, eficiencia_canchas: 0 },
    eficiencia_canchas: { porcentaje: 0, bloques_ocupados: 0, bloques_disponibles: 0, por_cancha: [] },
    ingresos_metodos: { metodos: [], catalogo: Object.entries(METODOS_PAGO_META).map(([id, meta]) => ({ id, ...meta })) },
    tendencia: buckets,
    historial: [],
    ingresos_por_cancha: [],
    filtros,
  };
};

/**
 * GET /api/complejos/:id/finanzas/resumen
 * Query: periodo, fecha_desde, fecha_hasta, cancha_id, sport_id
 */
export const getFinanzasResumen = async (req, res) => {
  try {
    const complejoId = parseInt(req.params.id, 10);
    const canchaIdFiltro = req.query.cancha_id ? parseInt(req.query.cancha_id, 10) : null;
    const deporteClave =
      req.query.deporte_clave ||
      (req.query.sport_id ? `sport:${parseInt(req.query.sport_id, 10)}` : null);

    if (Number.isNaN(complejoId)) {
      return res.status(400).json({ success: false, message: 'ID de complejo inválido' });
    }

    const acceso = await UsuarioComplejo.findOne({
      where: { user_id: req.user.id, complejo_id: complejoId },
    });

    if (!acceso) {
      return res.status(403).json({ success: false, message: 'No tienes acceso a este complejo' });
    }

    const { fechaDesde, fechaHasta, periodo } = resolverRangoFechas(
      req.query.periodo,
      req.query.fecha_desde,
      req.query.fecha_hasta
    );

    const canchasCatalogo = await Canchas.findAll({
      where: CANCHAS_ACTIVAS_WHERE(complejoId),
      include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
      attributes: ['id', 'nombre', 'sport_id', 'tipo_deporte'],
      order: [['nombre', 'ASC'], ['id', 'ASC']],
    });

    const filtros = construirCatalogoFiltros(canchasCatalogo);

    if (!canchasCatalogo.length) {
      return res.status(200).json(respuestaVaciaFinanzas(fechaDesde, fechaHasta, periodo, filtros));
    }

    if (canchaIdFiltro && !canchasCatalogo.some((c) => c.id === canchaIdFiltro)) {
      return res.status(400).json({ success: false, message: 'La cancha no pertenece a este complejo' });
    }

    if (deporteClave && !filtros.deportes.some((d) => d.clave === deporteClave)) {
      return res.status(400).json({ success: false, message: 'Deporte no disponible en este complejo' });
    }

    const canchasFiltradas = filtrarCanchasParaConsulta(canchasCatalogo, {
      deporteClave,
      canchaIdFiltro,
    });

    const canchaIds = canchasFiltradas.map((c) => c.id);

    if (!canchaIds.length) {
      return res.status(200).json(respuestaVaciaFinanzas(fechaDesde, fechaHasta, periodo, filtros));
    }

    const baseWhere = whereReservasActivas(canchaIds, fechaDesde, fechaHasta, canchaIdFiltro);
    const granularidadTendencia = resolverGranularidadTendencia(periodo);
    const configTendencia = atributosTendencia(granularidadTendencia);
    const configTendenciaMetodo = atributosTendenciaPorMetodo(granularidadTendencia);

    const [kpisRow, tendenciaRows, tendenciaPorMetodoRows, totalesPorMetodoRows, historialRows, reservasOcupacion, ingresosPorCanchaRows, horariosComplejo] =
      await Promise.all([
      Reservas.findOne({
        where: baseWhere,
        attributes: [
          [
            sequelize.fn(
              'COALESCE',
              sequelize.fn('SUM', sequelize.literal(MONTO_INGRESO)),
              0
            ),
            'ingresos_totales',
          ],
          [
            sequelize.fn(
              'COALESCE',
              sequelize.fn(
                'SUM',
                sequelize.literal(
                  `CASE WHEN "reservas"."metodo_pago" = 'EFECTIVO' THEN ${MONTO_INGRESO} ELSE 0 END`
                )
              ),
              0
            ),
            'efectivo_caja',
          ],
          [
            sequelize.fn(
              'COALESCE',
              sequelize.fn(
                'SUM',
                sequelize.literal(
                  `CASE WHEN "reservas"."metodo_pago" = 'PAGOS_APP' THEN ${MONTO_INGRESO} ELSE 0 END`
                )
              ),
              0
            ),
            'recaudado_zyra',
          ],
        ],
        raw: true,
      }),

      Reservas.findAll({
        where: baseWhere,
        ...configTendencia,
        raw: true,
      }),

      Reservas.findAll({
        where: baseWhere,
        ...configTendenciaMetodo,
        raw: true,
      }),

      Reservas.findAll({
        where: baseWhere,
        attributes: [
          'metodo_pago',
          [sequelize.fn('SUM', sequelize.literal(MONTO_INGRESO)), 'monto'],
        ],
        group: ['metodo_pago'],
        raw: true,
      }),

      Reservas.findAll({
        where: baseWhere,
        include: [
          { model: User, as: 'usuario', attributes: ['id', 'name', 'nick'] },
          { model: Canchas, as: 'cancha', attributes: ['id', 'nombre'] },
        ],
        attributes: [
          'id',
          'fecha',
          'hora_inicio',
          'monto_total',
          'monto_abono',
          'estado_pago',
          'metodo_pago',
          'nombre_contacto',
          'origen_reserva',
        ],
        order: [
          ['fecha', 'DESC'],
          ['hora_inicio', 'DESC'],
        ],
      }),

      Reservas.findAll({
        where: whereOcupacionCanchas(canchaIds, fechaDesde, fechaHasta, canchaIdFiltro),
        attributes: ['cancha_id', 'duracion_minutos'],
        raw: true,
      }),

      Reservas.findAll({
        where: baseWhere,
        attributes: [
          'cancha_id',
          [sequelize.fn('SUM', sequelize.literal(MONTO_INGRESO)), 'monto'],
        ],
        group: ['cancha_id'],
        raw: true,
      }),

      ComplejoHorarios.findAll({
        where: { complejo_id: complejoId, esta_cerrado: false },
        attributes: ['dia_semana', 'hora_apertura', 'hora_cierre', 'esta_cerrado'],
        raw: true,
      }),
    ]);

    const metricasOcupacion = calcularMetricasOcupacion(
      canchasFiltradas,
      fechaDesde,
      fechaHasta,
      horariosComplejo,
      reservasOcupacion
    );

    const { granularidad, buckets: tendenciaBase } = construirTendenciaDesdeFilas(
      fechaDesde,
      fechaHasta,
      periodo,
      tendenciaRows
    );

    const tendencia = enriquecerTendenciaConMetodos(
      tendenciaBase,
      tendenciaPorMetodoRows,
      granularidad
    );

    const ingresosMetodos = construirResumenMetodosPago(totalesPorMetodoRows);

    const historial = historialRows.map((reserva) => {
      const fechaStr = String(reserva.fecha).slice(0, 10);
      const cliente =
        reserva.nombre_contacto ||
        reserva.usuario?.name ||
        reserva.usuario?.nick ||
        'Cliente';

      const hora = String(reserva.hora_inicio ?? '').slice(0, 5);

      return {
        id: reserva.id,
        fecha: fechaStr,
        fecha_legible: formatearFechaLegible(fechaStr),
        hora,
        concepto: `Reserva ${reserva.cancha?.nombre ?? 'Cancha'} — ${cliente}`,
        folio: `ZYR-${fechaStr.replace(/-/g, '')}-${String(reserva.id).padStart(4, '0')}`,
        metodo_pago: reserva.metodo_pago,
        metodo_label: etiquetaMetodoPago(reserva.metodo_pago),
        atendido_por: cliente,
        cliente,
        monto: calcularMontoReserva(reserva),
        origen_reserva: reserva.origen_reserva,
      };
    });

    const canchasPorId = Object.fromEntries(canchasCatalogo.map((c) => [c.id, c.nombre]));
    const ingresosPorCancha = ingresosPorCanchaRows.map((fila) => ({
      id: fila.cancha_id,
      nombre: canchasPorId[fila.cancha_id] ?? `Cancha ${fila.cancha_id}`,
      monto: parseFloat(fila.monto ?? 0),
    }));
    const maxIngresoCancha = Math.max(...ingresosPorCancha.map((f) => f.monto), 1);
    const ingresosPorCanchaConPct = ingresosPorCancha.map((f) => ({
      ...f,
      porcentaje: Math.round((f.monto / maxIngresoCancha) * 100),
    }));

    res.status(200).json({
      success: true,
      periodo: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta, clave: periodo },
      tendencia_granularidad: granularidad,
      kpis: {
        ingresos_totales: parseFloat(kpisRow?.ingresos_totales ?? 0),
        efectivo_caja: parseFloat(kpisRow?.efectivo_caja ?? 0),
        recaudado_zyra: parseFloat(kpisRow?.recaudado_zyra ?? 0),
        eficiencia_canchas: metricasOcupacion.porcentaje,
      },
      eficiencia_canchas: metricasOcupacion,
      tendencia,
      historial,
      historial_total: historial.length,
      ingresos_metodos: ingresosMetodos,
      ingresos_por_cancha: ingresosPorCanchaConPct,
      filtros,
    });
  } catch (error) {
    console.error('[getFinanzasResumen] ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar el resumen financiero',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
