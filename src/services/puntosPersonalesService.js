import {
  Partidos,
  Torneos,
  EventosPartido,
  ValoresPuntosAccion,
  PartidoNominas,
} from '../db/db.js';
import { ordenarEventos, filtrarEventosValidos } from './reducerPartido.js';

/** Punto anotado sin detalle opcional (sin tipo_accion en detalle_json). */
export const PUNTOS_PERSONALES_POR_DEFECTO = 1;

/**
 * Clave de acción usada en valores_puntos_accion.
 * Solo lee detalle_json.tipo_accion — sin lógica específica por deporte.
 */
export const resolverClaveAccionDesdeEvento = (evento) => {
  if (!evento || evento.tipo_evento !== 'PUNTO') {
    return null;
  }

  const detalle = evento.detalle_json ?? {};
  const clave = detalle.tipo_accion;

  if (typeof clave !== 'string' || !clave.trim()) {
    return null;
  }

  return clave.trim().toUpperCase();
};

export const resolverJugadorIdDesdeEvento = (evento) => {
  const detalle = evento.detalle_json ?? {};
  if (detalle.jugador_id != null) {
    const id = Number(detalle.jugador_id);
    return Number.isNaN(id) ? null : id;
  }
  if (detalle.origen === 'JUGADOR' && evento.actor_principal_id != null) {
    return evento.actor_principal_id;
  }
  return null;
};

export const resolverSportIdPartido = async (partidoId, transaction = null) => {
  const partido = await Partidos.findByPk(partidoId, {
    attributes: ['sport_id', 'torneo_id'],
    include: [{
      model: Torneos,
      as: 'torneo',
      attributes: ['sport_id'],
    }],
    transaction,
  });

  if (!partido) {
    return null;
  }

  return partido.sport_id ?? partido.torneo?.sport_id ?? null;
};

const cargarMapaValoresAccion = async (sportId, transaction = null) => {
  if (!sportId) {
    return new Map();
  }

  const filas = await ValoresPuntosAccion.findAll({
    where: { sport_id: sportId },
    attributes: ['tipo_accion', 'puntos_otorgados'],
    transaction,
  });

  return new Map(
    filas.map((fila) => [
      fila.tipo_accion.toUpperCase(),
      fila.puntos_otorgados,
    ])
  );
};

const cargarEventosValidosPartido = async (partidoId, transaction = null) => {
  const eventos = await EventosPartido.findAll({
    where: { partido_id: partidoId },
    transaction,
  });

  return filtrarEventosValidos(ordenarEventos(eventos.map((e) => e.toJSON())));
};

const contarGolesJugador = (eventosValidos, jugadorId) =>
  eventosValidos.filter((evento) => {
    if (evento.tipo_evento !== 'PUNTO') return false;
    return resolverJugadorIdDesdeEvento(evento) === jugadorId;
  }).length;

const contarSancionesJugador = (eventosValidos, jugadorId, tarjeta) =>
  eventosValidos.filter((evento) => {
    if (evento.tipo_evento !== 'SANCION') return false;
    if (evento.actor_principal_id !== jugadorId) return false;
    return evento.detalle_json?.tarjeta === tarjeta;
  }).length;

/**
 * Puntos personales de un evento PUNTO según valores_puntos_accion.
 * Sin tipo_accion → PUNTOS_PERSONALES_POR_DEFECTO (agnóstico al deporte).
 */
export const resolverPuntosDesdeEvento = (evento, mapaValores) => {
  if (!evento || evento.tipo_evento !== 'PUNTO') {
    return 0;
  }

  const clave = resolverClaveAccionDesdeEvento(evento);
  if (!clave) {
    return PUNTOS_PERSONALES_POR_DEFECTO;
  }

  const puntos = mapaValores.get(clave);
  if (puntos == null) {
    return 0;
  }

  return puntos;
};

/**
 * Suma puntos personales de un jugador en un partido según valores_puntos_accion.
 */
export const calcularPuntosPersonales = async (
  partidoId,
  jugadorId,
  deps = {}
) => {
  const transaction = deps.transaction ?? null;
  const eventosPrecargados = deps.eventosValidos ?? null;
  const mapaValoresPrecargado = deps.mapaValores ?? null;
  const sportIdPrecargado = deps.sportId ?? null;

  const sportId = sportIdPrecargado
    ?? await resolverSportIdPartido(partidoId, transaction);

  const eventosValidos = eventosPrecargados
    ?? await cargarEventosValidosPartido(partidoId, transaction);

  const mapaValores = mapaValoresPrecargado
    ?? await cargarMapaValoresAccion(sportId, transaction);

  let total = 0;

  for (const evento of eventosValidos) {
    if (evento.tipo_evento !== 'PUNTO') {
      continue;
    }

    if (resolverJugadorIdDesdeEvento(evento) !== jugadorId) {
      continue;
    }

    total += resolverPuntosDesdeEvento(evento, mapaValores);
  }

  return total;
};

export const calcularStatsJugadorPartido = async (
  partidoId,
  jugadorId,
  teamId,
  deps = {}
) => {
  const transaction = deps.transaction ?? null;
  const sportId = deps.sportId
    ?? await resolverSportIdPartido(partidoId, transaction);
  const eventosValidos = deps.eventosValidos
    ?? await cargarEventosValidosPartido(partidoId, transaction);
  const mapaValores = deps.mapaValores
    ?? await cargarMapaValoresAccion(sportId, transaction);

  const puntosPersonales = await calcularPuntosPersonales(partidoId, jugadorId, {
    transaction,
    eventosValidos,
    mapaValores,
    sportId,
  });

  return {
    partido_id: partidoId,
    user_id: jugadorId,
    team_id: teamId,
    puntos_personales: puntosPersonales,
    goles: contarGolesJugador(eventosValidos, jugadorId),
    asistencias: 0,
    amarillas: contarSancionesJugador(eventosValidos, jugadorId, 'AMARILLA'),
    rojas: contarSancionesJugador(eventosValidos, jugadorId, 'ROJA'),
  };
};

export const listarJugadoresNominaPartido = async (partidoId, transaction = null) => {
  const nominas = await PartidoNominas.findAll({
    where: {
      partido_id: partidoId,
      estado_validacion: 'VALIDADO',
    },
    attributes: ['user_id', 'team_id'],
    transaction,
  });

  const vistos = new Set();
  return nominas.filter((nomina) => {
    const clave = `${nomina.team_id}:${nomina.user_id}`;
    if (vistos.has(clave)) {
      return false;
    }
    vistos.add(clave);
    return true;
  });
};

export {
  cargarEventosValidosPartido,
  cargarMapaValoresAccion,
  contarGolesJugador,
};
