export const TIPOS_DURACION_VALIDOS = ['RELAMPAGO', 'MULTIPLE_DIAS'];
export const METODOS_DISTRIBUCION_VALIDOS = ['ALEATORIO', 'MANUAL'];
export const DURACION_SET_DEFAULTS = {
  duracion_promedio_set_minutos: 30,
  descanso_entre_sets_minutos: 5,
};

/** Margen de seguridad sobre la duración estimada (momento 1 — programación inicial). */
export const MARGEN_SEGURIDAD_PARTIDO_MINUTOS = 17;

/** Umbral de desfase real vs estimado para disparar recálculo (momento 2). */
export const UMBRAL_DESFASE_RECALCULO_MINUTOS = 15;

/** Rango del descanso mínimo ENTRE partidos del mismo equipo (independiente de duración del partido). */
export const DESCANSO_MINIMO_ENTRE_PARTIDOS_MIN = 15;
export const DESCANSO_MINIMO_ENTRE_PARTIDOS_MAX = 20;
export const TIPOS_FORMATO_FASE = [
  'TODOS_CONTRA_TODOS',
  'ELIMINACION_DIRECTA',
  'GRUPOS_ELIMINATORIAS',
];

const parseEnteroPositivo = (value, { min = 1, allowNull = true } = {}) => {
  if (value === undefined) return { omit: true };
  if (value === null || value === '') {
    return allowNull ? { value: null } : { error: 'Valor requerido' };
  }
  const n = parseInt(value, 10);
  if (Number.isNaN(n) || n < min) {
    return { error: `Debe ser un entero >= ${min}` };
  }
  return { value: n };
};

const parseBooleano = (value) => {
  if (value === undefined) return { omit: true };
  if (typeof value === 'boolean') return { value };
  if (value === 'true' || value === 1 || value === '1') return { value: true };
  if (value === 'false' || value === 0 || value === '0') return { value: false };
  return { error: 'Debe ser booleano' };
};

const parseHora = (value) => {
  if (value === undefined) return { omit: true };
  if (value === null || value === '') return { value: null };
  const str = String(value).trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    return { error: 'Formato de hora inválido (HH:MM)' };
  }
  return { value: str.length === 5 ? `${str}:00` : str };
};

const parseFecha = (value) => {
  if (value === undefined) return { omit: true };
  if (value === null || value === '') return { value: null };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { error: 'fecha_fin inválida' };
  return { value: d.toISOString().slice(0, 10) };
};

/**
 * Extrae y valida campos de configuración de torneo desde body HTTP.
 */
export const parsearConfigTorneoBody = (body = {}) => {
  const updates = {};
  const errors = [];

  const camposEnteros = [
    ['max_jugadores_equipo', { min: 1 }],
    ['numero_canchas', { min: 1, allowNull: false }],
    // descanso_minimo_minutos: calculado automáticamente, no editable vía API
    ['duracion_promedio_set_minutos', { min: 1, allowNull: false }],
    ['descanso_entre_sets_minutos', { min: 0, allowNull: false }],
    ['numero_grupos', { min: 2 }],
    ['clasificados_por_grupo', { min: 1 }],
  ];

  for (const [campo, opts] of camposEnteros) {
    if (body[campo] === undefined) continue;
    const parsed = parseEnteroPositivo(body[campo], opts);
    if (parsed.error) errors.push(`${campo}: ${parsed.error}`);
    else updates[campo] = parsed.value;
  }

  if (body.tipo_duracion !== undefined) {
    if (body.tipo_duracion === null || body.tipo_duracion === '') {
      updates.tipo_duracion = 'RELAMPAGO';
    } else if (!TIPOS_DURACION_VALIDOS.includes(body.tipo_duracion)) {
      errors.push('tipo_duracion debe ser RELAMPAGO o MULTIPLE_DIAS');
    } else {
      updates.tipo_duracion = body.tipo_duracion;
    }
  }

  if (body.metodo_distribucion !== undefined) {
    if (body.metodo_distribucion === null || body.metodo_distribucion === '') {
      updates.metodo_distribucion = null;
    } else if (!METODOS_DISTRIBUCION_VALIDOS.includes(body.metodo_distribucion)) {
      errors.push('metodo_distribucion debe ser ALEATORIO o MANUAL');
    } else {
      updates.metodo_distribucion = body.metodo_distribucion;
    }
  }

  const fechaFin = parseFecha(body.fecha_fin);
  if (fechaFin.error) errors.push(fechaFin.error);
  else if (!fechaFin.omit) updates.fecha_fin = fechaFin.value;

  const horaInicio = parseHora(body.hora_inicio_diaria);
  if (horaInicio.error) errors.push(`hora_inicio_diaria: ${horaInicio.error}`);
  else if (!horaInicio.omit) updates.hora_inicio_diaria = horaInicio.value;

  const horaFin = parseHora(body.hora_fin_diaria);
  if (horaFin.error) errors.push(`hora_fin_diaria: ${horaFin.error}`);
  else if (!horaFin.omit) updates.hora_fin_diaria = horaFin.value;

  const reqGrupos = parseBooleano(body.requiere_partido_grupos_para_eliminatoria);
  if (reqGrupos.error) errors.push(reqGrupos.error);
  else if (!reqGrupos.omit) updates.requiere_partido_grupos_para_eliminatoria = reqGrupos.value;

  return { updates, errors };
};

export const REGLAS_ARBITRAJE_DEFAULT = {
  sets_para_ganar: 3,
  puntos_por_set: 25,
  ventaja_obligatoria: 2,
  puntos_set_decisivo: 15,
};

/**
 * Valida y normaliza reglas_arbitraje_json desde body HTTP.
 */
export const parseReglasArbitrajeBody = (body = {}) => {
  if (body.reglas_arbitraje_json === undefined) {
    return { reglas: {}, errors: [] };
  }

  const raw = body.reglas_arbitraje_json;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { reglas: {}, errors: ['reglas_arbitraje_json debe ser un objeto'] };
  }

  const errors = [];
  const reglas = {};

  if (raw.sets_para_ganar !== undefined) {
    const n = parseInt(raw.sets_para_ganar, 10);
    if (![2, 3].includes(n)) {
      errors.push('sets_para_ganar debe ser 2 (mejor de 3) o 3 (mejor de 5)');
    } else {
      reglas.sets_para_ganar = n;
    }
  }

  if (raw.puntos_por_set !== undefined) {
    const n = parseInt(raw.puntos_por_set, 10);
    if (Number.isNaN(n) || n < 1 || n > 99) {
      errors.push('puntos_por_set debe estar entre 1 y 99');
    } else {
      reglas.puntos_por_set = n;
    }
  }

  if (raw.puntos_set_decisivo !== undefined) {
    const n = parseInt(raw.puntos_set_decisivo, 10);
    if (Number.isNaN(n) || n < 1 || n > 99) {
      errors.push('puntos_set_decisivo debe estar entre 1 y 99');
    } else {
      reglas.puntos_set_decisivo = n;
    }
  }

  if (raw.ventaja_obligatoria !== undefined) {
    const n = parseInt(raw.ventaja_obligatoria, 10);
    if (![1, 2].includes(n)) {
      errors.push('ventaja_obligatoria debe ser 1 (sin ventaja) o 2 (diferencia de 2)');
    } else {
      reglas.ventaja_obligatoria = n;
    }
  }

  if (errors.length) {
    return { reglas: {}, errors };
  }

  if (Object.keys(reglas).length === 0) {
    return { reglas: {}, errors: [] };
  }

  return { reglas, errors: [] };
};

export const esPotenciaDeDos = (n) => n > 0 && (n & (n - 1)) === 0;

/**
 * Validación de config grupos+eliminatorias antes de generar fixture.
 */
export const validarConfigGruposEliminatorias = (torneo) => {
  const errores = [];
  const numeroGrupos = torneo.numero_grupos;
  const clasificados = torneo.clasificados_por_grupo;
  const metodo = torneo.metodo_distribucion;

  if (!numeroGrupos || numeroGrupos < 2) {
    errores.push('numero_grupos debe ser al menos 2');
  }
  if (!clasificados || clasificados < 1) {
    errores.push('clasificados_por_grupo debe ser al menos 1');
  }
  if (!metodo || !METODOS_DISTRIBUCION_VALIDOS.includes(metodo)) {
    errores.push('metodo_distribucion debe ser ALEATORIO o MANUAL');
  }

  const totalClasificados = (numeroGrupos ?? 0) * (clasificados ?? 0);
  let advertenciaBye = null;

  if (totalClasificados > 0 && !esPotenciaDeDos(totalClasificados)) {
    advertenciaBye =
      `Con ${numeroGrupos} grupos y ${clasificados} clasificados por grupo (${totalClasificados} equipos), `
      + 'algunos equipos necesitarán un bye — ¿continuar?';
  }

  return {
    ok: errores.length === 0,
    errores,
    advertenciaBye,
    totalClasificados,
    tamanoBracket: totalClasificados > 0
      ? 2 ** Math.ceil(Math.log2(totalClasificados))
      : 0,
  };
};

/**
 * Sets máximos posibles según sets_para_ganar (2 → 3 sets, 3 → 5 sets).
 */
export const calcularMaxSetsPartido = (setsParaGanar) => {
  const setsGanar = setsParaGanar === 2 ? 2 : 3;
  return setsGanar * 2 - 1;
};

/**
 * Duración estimada del partido en el peor caso (todos los sets posibles).
 */
export const calcularDuracionEstimadaPartidoMinutos = ({
  setsParaGanar = 3,
  duracionPromedioSetMinutos = DURACION_SET_DEFAULTS.duracion_promedio_set_minutos,
  descansoEntreSetsMinutos = DURACION_SET_DEFAULTS.descanso_entre_sets_minutos,
} = {}) => {
  const maxSets = calcularMaxSetsPartido(setsParaGanar);
  const descansosEntreSets = maxSets - 1;
  return (maxSets * duracionPromedioSetMinutos) + (descansosEntreSets * descansoEntreSetsMinutos);
};

export const resolverSetsParaGanarTorneo = (torneo = {}) => {
  const reglas = torneo.reglas_arbitraje_json ?? {};
  return reglas.sets_para_ganar === 2 ? 2 : 3;
};

/**
 * Duración base (peor caso de sets) sin margen de seguridad.
 */
export const calcularDuracionBasePartidoMinutos = (torneo = {}) => {
  const setsParaGanar = resolverSetsParaGanarTorneo(torneo);
  return calcularDuracionEstimadaPartidoMinutos({
    setsParaGanar,
    duracionPromedioSetMinutos: torneo.duracion_promedio_set_minutos
      ?? DURACION_SET_DEFAULTS.duracion_promedio_set_minutos,
    descansoEntreSetsMinutos: torneo.descanso_entre_sets_minutos
      ?? DURACION_SET_DEFAULTS.descanso_entre_sets_minutos,
  });
};

/**
 * Duración usada para programar slots (momento 1): estimación + margen de seguridad.
 */
export const calcularDuracionPartidoProgramacionMinutos = (torneo = {}) =>
  calcularDuracionBasePartidoMinutos(torneo) + MARGEN_SEGURIDAD_PARTIDO_MINUTOS;

/**
 * Descanso mínimo ENTRE PARTIDOS del mismo equipo — automático, no editable.
 * Buffer corto e independiente de cuánto dura jugar un partido.
 * Deriva de descanso_entre_sets × 3, acotado a 15–20 min.
 */
export const calcularDescansoMinimoEntrePartidos = (
  descansoEntreSetsMinutos = DURACION_SET_DEFAULTS.descanso_entre_sets_minutos
) => {
  const derivado = descansoEntreSetsMinutos * 3;
  return Math.min(
    DESCANSO_MINIMO_ENTRE_PARTIDOS_MAX,
    Math.max(DESCANSO_MINIMO_ENTRE_PARTIDOS_MIN, derivado)
  );
};

export const obtenerConfigLogistica = (torneo) => {
  const duracionPromedioSet = torneo.duracion_promedio_set_minutos
    ?? DURACION_SET_DEFAULTS.duracion_promedio_set_minutos;
  const descansoEntreSets = torneo.descanso_entre_sets_minutos
    ?? DURACION_SET_DEFAULTS.descanso_entre_sets_minutos;
  const setsParaGanar = resolverSetsParaGanarTorneo(torneo);
  const duracionBasePartido = calcularDuracionEstimadaPartidoMinutos({
    setsParaGanar,
    duracionPromedioSetMinutos: duracionPromedioSet,
    descansoEntreSetsMinutos: descansoEntreSets,
  });
  const duracionPartidoProgramacion = duracionBasePartido + MARGEN_SEGURIDAD_PARTIDO_MINUTOS;
  const descansoMinimoEntrePartidos = calcularDescansoMinimoEntrePartidos(descansoEntreSets);

  return {
    numero_canchas: torneo.numero_canchas ?? 1,
    tipo_duracion: torneo.tipo_duracion ?? 'RELAMPAGO',
    fecha_hora_inicio: torneo.fecha_hora_inicio ?? null,
    fecha_fin: torneo.fecha_fin ?? null,
    hora_inicio_diaria: torneo.hora_inicio_diaria ?? '08:00:00',
    hora_fin_diaria: torneo.hora_fin_diaria ?? '22:00:00',
    duracion_promedio_set_minutos: duracionPromedioSet,
    descanso_entre_sets_minutos: descansoEntreSets,
    sets_para_ganar: setsParaGanar,
    duracion_base_partido_minutos: duracionBasePartido,
    margen_seguridad_partido_minutos: MARGEN_SEGURIDAD_PARTIDO_MINUTOS,
    duracion_partido_programacion_minutos: duracionPartidoProgramacion,
    descanso_minimo_entre_partidos_minutos: descansoMinimoEntrePartidos,
    /** @deprecated usar duracion_partido_programacion_minutos */
    duracion_estimada_partido_minutos: duracionPartidoProgramacion,
    /** @deprecated usar descanso_minimo_entre_partidos_minutos (automático) */
    descanso_minimo_minutos: descansoMinimoEntrePartidos,
  };
};
