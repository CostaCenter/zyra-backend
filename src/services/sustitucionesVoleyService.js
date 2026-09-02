import { filtrarEventosValidos, ordenarEventos, reducirMarcador } from './reducerPartido.js';
import { cargarEventosValidosPartido } from './puntosPersonalesService.js';

/** Referencia reglamento FIVB — usar si se reactiva límite por torneo. */
export const LIMITE_SUSTITUCIONES_POR_SET_DEFAULT = 6;

/**
 * Límite activo por set/equipo. `null` = ilimitado (decisión operativa actual).
 * Para reactivar: p. ej. `LIMITE_SUSTITUCIONES_POR_SET_DEFAULT` o valor desde config de torneo.
 */
export const LIMITE_SUSTITUCIONES_POR_SET_ACTIVO = null;

/** @deprecated Usar LIMITE_SUSTITUCIONES_POR_SET_DEFAULT */
export const MAX_SUSTITUCIONES_POR_SET = LIMITE_SUSTITUCIONES_POR_SET_DEFAULT;

export const motivoLimiteSustituciones = (limite = LIMITE_SUSTITUCIONES_POR_SET_DEFAULT) =>
  `Este equipo ya usó sus ${limite} sustituciones permitidas en este set`;

/** @deprecated Usar motivoLimiteSustituciones */
export const MOTIVO_LIMITE_SUSTITUCIONES = motivoLimiteSustituciones();

const REGLAS_VOLEY_DEFAULT = {
  puntos_por_set: 25,
  ventaja_obligatoria: 2,
  sets_para_ganar: 3,
};

export const contarSustitucionesUsadas = (cambiosOrdenados = []) => cambiosOrdenados.length;

/**
 * Evalúa límite configurable. Con `limite` null no bloquea; solo expone conteo.
 */
export const evaluarLimiteSustituciones = (
  sustitucionesUsadas,
  limite = LIMITE_SUSTITUCIONES_POR_SET_ACTIVO
) => {
  const usadas = sustitucionesUsadas ?? 0;

  if (limite == null || limite <= 0) {
    return {
      excedido: false,
      sustitucionesUsadas: usadas,
      sustitucionesRestantes: null,
      limiteAplicado: null,
    };
  }

  if (usadas >= limite) {
    return {
      excedido: true,
      motivo: motivoLimiteSustituciones(limite),
      sustitucionesUsadas: usadas,
      sustitucionesRestantes: 0,
      limiteAplicado: limite,
    };
  }

  return {
    excedido: false,
    sustitucionesUsadas: usadas,
    sustitucionesRestantes: limite - usadas,
    limiteAplicado: limite,
  };
};

export const resolverSetNumeroEvento = (evento, eventosValidos, reglas = REGLAS_VOLEY_DEFAULT) => {
  const setDesdeDetalle = Number(evento.detalle_json?.set_numero);
  if (Number.isFinite(setDesdeDetalle) && setDesdeDetalle >= 1) {
    return setDesdeDetalle;
  }

  const indice = eventosValidos.findIndex((evt) => evt.id === evento.id);
  if (indice < 0) {
    return null;
  }

  const eventosAntes = eventosValidos.slice(0, indice);
  const puntosAntes = eventosAntes.filter((evt) => evt.tipo_evento === 'PUNTO');
  if (puntosAntes.length === 0) {
    return 1;
  }

  const marcadorParcial = reducirMarcador(puntosAntes, reglas);
  const parciales = marcadorParcial.metrica_estructura?.parciales_sets ?? [];
  return parciales.length + 1;
};

export const normalizarCambio = (evento) => ({
  saliente_id: evento.detalle_json?.saliente_id ?? evento.saliente_id,
  entrante_id: evento.detalle_json?.entrante_id ?? evento.entrante_id,
  set_numero: evento.detalle_json?.set_numero ?? null,
  equipo: evento.detalle_json?.equipo ?? null,
});

/**
 * Historial de cambios de un equipo en un set (orden cronológico).
 */
export const filtrarCambiosEquipoEnSet = (
  eventosValidos,
  setNumero,
  equipo,
  reglas = REGLAS_VOLEY_DEFAULT
) =>
  eventosValidos
    .filter((evento) => evento.tipo_evento === 'CAMBIO')
    .filter((evento) => evento.detalle_json?.equipo === equipo)
    .filter((evento) => resolverSetNumeroEvento(evento, eventosValidos, reglas) === setNumero)
    .map(normalizarCambio);

export const construirEstadoSustituciones = (cambiosOrdenados = []) => {
  /** @type {Map<number, number>} suplente en cancha → titular que debe reingresar */
  const suplenteRequiereTitular = new Map();

  for (const cambio of cambiosOrdenados) {
    const sale = cambio.saliente_id;
    const entra = cambio.entrante_id;
    if (sale == null || entra == null) continue;

    if (suplenteRequiereTitular.has(sale)) {
      suplenteRequiereTitular.delete(sale);
    } else {
      suplenteRequiereTitular.set(entra, sale);
    }
  }

  return {
    sustitucionesUsadas: contarSustitucionesUsadas(cambiosOrdenados),
    suplenteRequiereTitular,
  };
};

const resolverNombreJugador = (nombresPorId, userId, fallback = 'su titular original') => {
  const nombre = nombresPorId?.[userId] ?? nombresPorId?.[String(userId)];
  return nombre || fallback;
};

export const validarSustitucionVoley = (
  cambiosPrevios = [],
  salienteId,
  entranteId,
  nombresPorId = {},
  limiteSustituciones = LIMITE_SUSTITUCIONES_POR_SET_ACTIVO
) => {
  const conteo = evaluarLimiteSustituciones(
    contarSustitucionesUsadas(cambiosPrevios),
    limiteSustituciones
  );

  if (conteo.excedido) {
    return { valido: false, motivo: conteo.motivo };
  }

  const { suplenteRequiereTitular } = construirEstadoSustituciones(cambiosPrevios);
  const saleNum = Number(salienteId);
  const entraNum = Number(entranteId);

  if (suplenteRequiereTitular.has(saleNum)) {
    const titularRequerido = suplenteRequiereTitular.get(saleNum);
    if (entraNum !== Number(titularRequerido)) {
      const nombreSuplente = resolverNombreJugador(nombresPorId, saleNum, 'El suplente');
      const nombreTitular = resolverNombreJugador(nombresPorId, titularRequerido, 'su titular original');
      return {
        valido: false,
        motivo: `${nombreSuplente} solo puede ser reemplazado por ${nombreTitular} (su titular original)`,
      };
    }
  }

  return {
    valido: true,
    sustitucionesUsadas: conteo.sustitucionesUsadas,
    sustitucionesRestantes: conteo.sustitucionesRestantes,
  };
};

export const puedeAbrirCambioVoley = (
  cambiosPrevios = [],
  limiteSustituciones = LIMITE_SUSTITUCIONES_POR_SET_ACTIVO
) => {
  const conteo = evaluarLimiteSustituciones(
    contarSustitucionesUsadas(cambiosPrevios),
    limiteSustituciones
  );

  if (conteo.excedido) {
    return { permitido: false, motivo: conteo.motivo };
  }

  return { permitido: true, sustitucionesUsadas: conteo.sustitucionesUsadas };
};

export const construirHistorialSustitucionesSet = async (
  partidoId,
  setNumero,
  reglas = REGLAS_VOLEY_DEFAULT,
  transaction = null
) => {
  const eventosValidos = await cargarEventosValidosPartido(partidoId, transaction);

  return {
    set_numero: setNumero,
    LOCAL: filtrarCambiosEquipoEnSet(eventosValidos, setNumero, 'LOCAL', reglas),
    VISITANTE: filtrarCambiosEquipoEnSet(eventosValidos, setNumero, 'VISITANTE', reglas),
  };
};

/** Eventos PUNTO/CAMBIO de un set concreto (orden cronológico preservado). */
export const filtrarEventosPorSet = (
  eventosValidos,
  setNumero,
  reglas = REGLAS_VOLEY_DEFAULT
) =>
  eventosValidos.filter((evento) => {
    if (evento.tipo_evento !== 'PUNTO' && evento.tipo_evento !== 'CAMBIO') {
      return false;
    }
    return resolverSetNumeroEvento(evento, eventosValidos, reglas) === setNumero;
  });

/** Lista cronológica de sustituciones del partido completo. */
export const construirListaCambiosPartido = async (
  partidoId,
  reglas = REGLAS_VOLEY_DEFAULT,
  transaction = null
) => {
  const eventosValidos = await cargarEventosValidosPartido(partidoId, transaction);

  return eventosValidos
    .filter((evento) => evento.tipo_evento === 'CAMBIO')
    .map((evento) => ({
      id: evento.id,
      set_numero: resolverSetNumeroEvento(evento, eventosValidos, reglas),
      ...normalizarCambio(evento),
      ocurrido_en: evento.ocurrido_en_cliente ?? null,
    }))
    .filter((cambio) => cambio.set_numero != null);
};

/** @deprecated Usar validarSustitucionVoley */
export const validarCambioVoleyPiso = (eventosDelSetActual, salienteId, entranteId) => {
  const cambios = eventosDelSetActual
    .filter((e) => e.tipo_evento === 'CAMBIO')
    .map(normalizarCambio);
  return validarSustitucionVoley(cambios, salienteId, entranteId);
};
