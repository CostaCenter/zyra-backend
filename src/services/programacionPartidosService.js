/**
 * ============================================================================
 * PROGRAMACIÓN DE HORARIOS DE PARTIDOS
 * ============================================================================
 *
 * MOMENTO 1 — Programación inicial (al generar fixture)
 * -----------------------------------------------------
 * Se ejecuta UNA vez, antes de que se juegue cualquier partido.
 * Usa duración ESTIMADA (peor caso de sets + margen de seguridad) y descanso
 * mínimo ENTRE PARTIDOS calculado automáticamente (no editable).
 * Asigna datetime + cancha_id + duracion_programada_minutos.
 *
 * MOMENTO 2 — Recalculación en vivo (ver recalculoHorariosService.js)
 * -------------------------------------------------------------------
 * Se dispara cuando un partido FINALIZADO se desvía > umbral de lo estimado.
 * Reprograma solo partidos pendientes (PROGRAMADO), respetando orden de jornada
 * y canchas/disponibilidad real a partir del momento actual.
 *
 * NOTA: descanso_entre_sets_minutos es DENTRO del partido (duración estimada).
 *       descanso_minimo_entre_partidos es buffer ENTRE partidos del mismo equipo (15–20 min, auto).
 * ============================================================================
 */

export {
  calcularDuracionEstimadaPartidoMinutos,
  MARGEN_SEGURIDAD_PARTIDO_MINUTOS,
  UMBRAL_DESFASE_RECALCULO_MINUTOS,
} from './torneoConfigService.js';

const MS_MINUTO = 60 * 1000;
const PASO_BUSQUEDA_MINUTOS = 5;

const parseHoraMinutos = (horaStr) => {
  const [h, m] = String(horaStr ?? '08:00').split(':').map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
};

const fechaKey = (date) => date.toISOString().slice(0, 10);

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return fechaKey(d);
};

const minutosAFecha = (fechaBase, minutosDesdeMedianoche) => {
  const d = new Date(fechaBase);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutosDesdeMedianoche);
  return d;
};

const redondearArribaMinutos = (date, paso = PASO_BUSQUEDA_MINUTOS) => {
  const ms = paso * MS_MINUTO;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
};

/** Si la ancla cae fuera de la ventana diaria, alinea al inicio del día del evento. */
const ajustarAnclaAVentanaDiaria = (ancla, cfg) => {
  const inicioMin = parseHoraMinutos(cfg.horaInicioDiaria);
  const finMin = parseHoraMinutos(cfg.horaFinDiaria);
  const dia = fechaKey(ancla);
  const minAncla = ancla.getHours() * 60 + ancla.getMinutes();

  if (minAncla < inicioMin) {
    return minutosAFecha(`${dia}T00:00:00`, inicioMin);
  }

  if (minAncla + cfg.duracionPartidoMinutos > finMin) {
    if (inicioMin + cfg.duracionPartidoMinutos <= finMin) {
      return minutosAFecha(`${dia}T00:00:00`, inicioMin);
    }
    if (cfg.tipoDuracion === 'MULTIPLE_DIAS' && cfg.fechaFin) {
      const siguiente = addDays(dia, 1);
      if (siguiente <= cfg.fechaFin) {
        return minutosAFecha(`${siguiente}T00:00:00`, inicioMin);
      }
    }
  }

  return ancla;
};

const estadosPartidoBloqueados = new Set(['FINALIZADO', 'EN_CURSO', 'WALKOVER']);

export const esPartidoProgramable = (state) =>
  !state || state === 'PROGRAMADO' || state === 'PENDIENTE';

export const esPartidoHorarioFijo = (state) =>
  estadosPartidoBloqueados.has(state);

export const normalizarConfigProgramacion = (config = {}) => ({
  fechaInicio: config.fechaInicio ?? config.fecha_hora_inicio ?? new Date(),
  fechaFin: config.fechaFin ?? config.fecha_fin ?? null,
  tipoDuracion: config.tipoDuracion ?? config.tipo_duracion ?? 'RELAMPAGO',
  horaInicioDiaria: config.horaInicioDiaria ?? config.hora_inicio_diaria ?? '08:00:00',
  horaFinDiaria: config.horaFinDiaria ?? config.hora_fin_diaria ?? '22:00:00',
  duracionPartidoMinutos: Math.max(
    15,
    config.duracionPartidoMinutos
      ?? config.duracion_partido_programacion_minutos
      ?? config.duracion_estimada_partido_minutos
      ?? 60
  ),
  numeroCanchas: config.numeroCanchas ?? config.numero_canchas ?? 1,
  descansoMinimoMinutos: config.descansoMinimoMinutos
    ?? config.descanso_minimo_entre_partidos_minutos
    ?? config.descanso_minimo_minutos
    ?? 30,
});

export const generarSlotsDisponibles = (config) => {
  const cfg = normalizarConfigProgramacion(config);
  const inicioMin = parseHoraMinutos(cfg.horaInicioDiaria);
  const finMin = parseHoraMinutos(cfg.horaFinDiaria);
  const duracion = cfg.duracionPartidoMinutos;

  if (finMin - inicioMin < duracion) {
    return { error: 'La ventana horaria diaria es menor que la duración estimada del partido' };
  }

  const baseDate = cfg.fechaInicio ? new Date(cfg.fechaInicio) : new Date();
  let diaActual = fechaKey(baseDate);
  const finDia = cfg.tipoDuracion === 'MULTIPLE_DIAS' && cfg.fechaFin
    ? cfg.fechaFin
    : diaActual;

  const slots = [];

  while (diaActual <= finDia) {
    for (let min = inicioMin; min + duracion <= finMin; min += duracion) {
      for (let cancha = 1; cancha <= cfg.numeroCanchas; cancha += 1) {
        slots.push({
          datetime: minutosAFecha(`${diaActual}T00:00:00`, min),
          cancha_id: cancha,
          dia: diaActual,
        });
      }
    }
    if (cfg.tipoDuracion !== 'MULTIPLE_DIAS') break;
    diaActual = addDays(diaActual, 1);
  }

  if (!slots.length) {
    return { error: 'No hay slots disponibles con la configuración de logística' };
  }

  return { slots, duracionPartidoMinutos: duracion };
};

const crearOcupacionCanchas = (numeroCanchas) => {
  const mapa = new Map();
  for (let c = 1; c <= numeroCanchas; c += 1) {
    mapa.set(c, []);
  }
  return mapa;
};

const haySolapamientoCancha = (intervalos, inicioMs, finMs) =>
  intervalos.some(({ inicio, fin }) => inicioMs < fin && finMs > inicio);

const registrarOcupacion = (intervalos, inicioMs, finMs) => {
  intervalos.push({ inicio: inicioMs, fin: finMs });
  intervalos.sort((a, b) => a.inicio - b.inicio);
};

const respetaVentanaDiaria = (inicio, finMs, cfg) => {
  const inicioMin = parseHoraMinutos(cfg.horaInicioDiaria);
  const finMin = parseHoraMinutos(cfg.horaFinDiaria);
  const minInicio = inicio.getHours() * 60 + inicio.getMinutes();
  const finDate = new Date(finMs);
  const minFin = finDate.getHours() * 60 + finDate.getMinutes();
  const mismoDia = fechaKey(inicio) === fechaKey(finDate);
  return mismoDia && minInicio >= inicioMin && minFin <= finMin;
};

const buscarHorarioValido = ({
  cfg,
  ocupacionCanchas,
  ultimoFinEquipo,
  horaMinima,
  equipos,
}) => {
  const duracionMs = cfg.duracionPartidoMinutos * MS_MINUTO;
  const descansoMs = cfg.descansoMinimoMinutos * MS_MINUTO;
  let cursor = redondearArribaMinutos(horaMinima);
  const limiteDias = cfg.tipoDuracion === 'MULTIPLE_DIAS' && cfg.fechaFin ? 60 : 1;
  let diasExplorados = 0;
  let diaBase = fechaKey(cursor);

  while (diasExplorados < limiteDias) {
    const inicioMin = parseHoraMinutos(cfg.horaInicioDiaria);
    const finMin = parseHoraMinutos(cfg.horaFinDiaria);
    const minCursor = cursor.getHours() * 60 + cursor.getMinutes();

    if (fechaKey(cursor) !== diaBase) {
      diaBase = fechaKey(cursor);
      diasExplorados += 1;
      cursor = minutosAFecha(`${diaBase}T00:00:00`, inicioMin);
    }

    if (minCursor + cfg.duracionPartidoMinutos > finMin) {
      if (cfg.tipoDuracion !== 'MULTIPLE_DIAS') break;
      const siguiente = addDays(diaBase, 1);
      if (cfg.fechaFin && siguiente > cfg.fechaFin) break;
      cursor = minutosAFecha(`${siguiente}T00:00:00`, inicioMin);
      continue;
    }

    for (let cancha = 1; cancha <= cfg.numeroCanchas; cancha += 1) {
      const inicioMs = cursor.getTime();
      const finMs = inicioMs + duracionMs;
      const intervalos = ocupacionCanchas.get(cancha) ?? [];

      if (haySolapamientoCancha(intervalos, inicioMs, finMs)) continue;

      const equiposValidos = equipos.filter(Boolean);
      const respetaDescanso = equiposValidos.every((teamId) => {
        const ultimo = ultimoFinEquipo.get(teamId);
        if (ultimo == null) return true;
        return inicioMs - ultimo >= descansoMs;
      });

      if (!respetaDescanso) continue;

      const inicioDate = new Date(inicioMs);
      if (!respetaVentanaDiaria(inicioDate, finMs, cfg)) continue;

      return {
        datetime: inicioDate,
        cancha_id: cancha,
        finMs,
      };
    }

    cursor = new Date(cursor.getTime() + PASO_BUSQUEDA_MINUTOS * MS_MINUTO);
  }

  return null;
};

export const programarPartidosConRestricciones = (
  partidos,
  configLogistica,
  { horaInicioDesde = null, partidosFijos = [] } = {}
) => {
  const cfg = normalizarConfigProgramacion(configLogistica);

  if (parseHoraMinutos(cfg.horaFinDiaria) - parseHoraMinutos(cfg.horaInicioDiaria)
    < cfg.duracionPartidoMinutos) {
    return { error: 'La ventana horaria diaria es menor que la duración estimada del partido' };
  }

  const ocupacionCanchas = crearOcupacionCanchas(cfg.numeroCanchas);
  const ultimoFinEquipo = new Map();

  const ancla = horaInicioDesde
    ? new Date(horaInicioDesde)
    : (cfg.fechaInicio ? new Date(cfg.fechaInicio) : new Date());

  for (const fijo of partidosFijos) {
    if (!fijo.datetime) continue;
    const inicioMs = new Date(fijo.datetime).getTime();
    const finMs = fijo.finRealMs
      ?? (inicioMs + (fijo.duracionMinutos ?? fijo.duracion_programada_minutos
        ?? cfg.duracionPartidoMinutos) * MS_MINUTO);
    const cancha = fijo.cancha_id ?? 1;
    if (ocupacionCanchas.has(cancha)) {
      registrarOcupacion(ocupacionCanchas.get(cancha), inicioMs, finMs);
    }
    for (const teamId of (fijo.equipos ?? []).filter(Boolean)) {
      const prev = ultimoFinEquipo.get(teamId) ?? 0;
      ultimoFinEquipo.set(teamId, Math.max(prev, finMs));
    }
  }

  const pendientes = [...partidos]
    .filter((p) => esPartidoProgramable(p.state))
    .sort((a, b) => {
      const ja = a.jornada ?? a.ronda ?? 0;
      const jb = b.jornada ?? b.ronda ?? 0;
      if (ja !== jb) return ja - jb;
      return (a.id ?? 0) - (b.id ?? 0);
    });

  const asignaciones = [];
  let cursorMinimo = ajustarAnclaAVentanaDiaria(ancla, cfg);

  for (const partido of pendientes) {
    const horario = buscarHorarioValido({
      cfg,
      ocupacionCanchas,
      ultimoFinEquipo,
      horaMinima: cursorMinimo,
      equipos: partido.equipos ?? [],
    });

    if (!horario) {
      return {
        error: `No se pudo programar el partido ${partido.id ?? '?'} respetando descanso y canchas`,
        asignacionesParciales: asignaciones,
      };
    }

    const { datetime, cancha_id, finMs } = horario;
    registrarOcupacion(ocupacionCanchas.get(cancha_id), datetime.getTime(), finMs);

    for (const teamId of (partido.equipos ?? []).filter(Boolean)) {
      ultimoFinEquipo.set(teamId, finMs);
    }

    asignaciones.push({
      partidoId: partido.id,
      datetime,
      cancha_id,
      duracion_programada_minutos: cfg.duracionPartidoMinutos,
    });

    cursorMinimo = new Date(datetime.getTime());
  }

  return { asignaciones, duracionPartidoMinutos: cfg.duracionPartidoMinutos };
};

/** MOMENTO 1 — al generar fixture. */
export const programarPartidosGreedy = (partidos, configLogistica) =>
  programarPartidosConRestricciones(partidos, configLogistica, {
    horaInicioDesde: configLogistica.fechaInicio ?? configLogistica.fecha_hora_inicio,
    partidosFijos: [],
  });

/** MOMENTO 2 — reprogramar pendientes. */
export const reprogramarPartidosPendientes = (
  partidosPendientes,
  partidosFijos,
  configLogistica,
  horaInicioDesde
) =>
  programarPartidosConRestricciones(partidosPendientes, configLogistica, {
    horaInicioDesde,
    partidosFijos,
  });

export const calcularFinEstimadoPartido = (partido, duracionFallbackMinutos = 60) => {
  if (!partido?.datetime) return null;
  const duracion = partido.duracion_programada_minutos
    ?? partido.duracionMinutos
    ?? duracionFallbackMinutos;
  return new Date(new Date(partido.datetime).getTime() + duracion * MS_MINUTO);
};

export const calcularDesfaseFinalizacionMinutos = (partido, finalizadoEn) => {
  const finEstimado = calcularFinEstimadoPartido(partido);
  if (!finEstimado || !finalizadoEn) return 0;
  return (new Date(finalizadoEn).getTime() - finEstimado.getTime()) / MS_MINUTO;
};
