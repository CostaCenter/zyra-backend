import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import {
  Partidos,
  MarcadoresDetalle,
  PartidoParticipantes,
  Team,
  User,
  Sports,
  Torneos,
  FaseTorneo,
  PartidoNominas,
} from '../db/db.js';
import {
  reducirMarcador,
  ordenarEventos,
  filtrarEventosValidos,
} from './reducerPartido.js';
import {
  cargarEventosValidosPartido,
  cargarMapaValoresAccion,
  resolverJugadorIdDesdeEvento,
  resolverPuntosDesdeEvento,
  resolverSportIdPartido,
} from './puntosPersonalesService.js';
import { construirHistorialSustitucionesSet, construirListaCambiosPartido } from './sustitucionesVoleyService.js';

const REGLAS_VOLEY_DEFAULT = {
  puntos_por_set: 25,
  puntos_set_decisivo: 15,
  ventaja_obligatoria: 2,
  sets_para_ganar: 3,
};

const calcularMinuto = (inicioPartido, momentoEvento) => {
  if (!inicioPartido || !momentoEvento) return null;
  const inicio = new Date(inicioPartido).getTime();
  const momento = new Date(momentoEvento).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(momento)) return null;
  const minutos = Math.floor((momento - inicio) / 60000);
  return Math.max(1, minutos);
};

const esVoleySport = (sportName = '') =>
  /v[oó]ley|volleyball/i.test(String(sportName));

/**
 * parciales_sets debe ser array de [puntosLocal, puntosVisitante] por set.
 * Rechaza el fallback erróneo [[setsGanadosLocal, setsGanadosVisitante]] (ej. [[3,1]]).
 */
const esParcialesSetsValido = (parciales, sportName = '') => {
  if (!Array.isArray(parciales) || parciales.length === 0) {
    return false;
  }

  if (!esVoleySport(sportName)) {
    return false;
  }

  return parciales.every((par) => {
    if (!Array.isArray(par) || par.length < 2) return false;
    const local = Number(par[0]);
    const visitante = Number(par[1]);
    if (!Number.isFinite(local) || !Number.isFinite(visitante)) return false;
    const max = Math.max(local, visitante);
    const total = local + visitante;
    // Puntaje típico de un set de vóley (≥15 y suele superar 20 en total)
    return max >= 15 && total >= 20;
  });
};

const resolverParcialesSets = (marcador, sportName = '') => {
  const parciales = marcador?.metrica_estructura?.parciales_sets;

  if (esParcialesSetsValido(parciales, sportName)) {
    return parciales;
  }

  return [];
};

const resolverReglasVoley = (reglasSnapshot) => ({
  ...REGLAS_VOLEY_DEFAULT,
  ...(reglasSnapshot && typeof reglasSnapshot === 'object' ? reglasSnapshot : {}),
});

const resolverSetSancionVoley = (evento, eventosValidos, reglas) => {
  const setDesdeDetalle = Number(evento.detalle_json?.set_numero);
  if (Number.isFinite(setDesdeDetalle) && setDesdeDetalle >= 1) {
    return setDesdeDetalle;
  }

  const indice = eventosValidos.findIndex((evt) => evt.id === evento.id);
  if (indice < 0) {
    return null;
  }

  const puntosAntes = eventosValidos
    .slice(0, indice)
    .filter((evt) => evt.tipo_evento === 'PUNTO');

  if (puntosAntes.length === 0) {
    return null;
  }

  const marcadorParcial = reducirMarcador(puntosAntes, reglas);
  const parciales = marcadorParcial.metrica_estructura?.parciales_sets ?? [];
  return parciales.length + 1;
};

const etiquetaFaseTorneo = (fase) => {
  if (!fase) return null;
  const nombre = String(fase.nombre ?? '').trim();
  if (nombre) return nombre;
  if (fase.orden != null) return `Jornada ${fase.orden}`;
  return null;
};

export const calcularMvpPartido = async (partidoId) => {
  const sportId = await resolverSportIdPartido(partidoId);
  const eventosValidos = await cargarEventosValidosPartido(partidoId);
  const mapaValores = await cargarMapaValoresAccion(sportId);

  const puntosPorJugador = new Map();

  for (const evento of eventosValidos) {
    if (evento.tipo_evento !== 'PUNTO') continue;
    const jugadorId = resolverJugadorIdDesdeEvento(evento);
    if (jugadorId == null) continue;
    const puntos = resolverPuntosDesdeEvento(evento, mapaValores);
    if (puntos <= 0) continue;
    puntosPorJugador.set(jugadorId, (puntosPorJugador.get(jugadorId) ?? 0) + puntos);
  }

  if (puntosPorJugador.size === 0) {
    return null;
  }

  let mejorJugadorId = null;
  let mejorPuntaje = -1;

  puntosPorJugador.forEach((puntaje, jugadorId) => {
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorJugadorId = jugadorId;
    }
  });

  if (mejorJugadorId == null) {
    return null;
  }

  const nomina = await PartidoNominas.findOne({
    where: {
      partido_id: partidoId,
      user_id: mejorJugadorId,
      estado_validacion: 'VALIDADO',
    },
    include: [
      {
        model: User,
        as: 'jugador',
        attributes: ['id', 'name', 'nick', 'photo'],
      },
      {
        model: Team,
        as: 'equipo',
        attributes: ['id', 'name', 'logo_url'],
      },
    ],
  });

  const jugador = nomina?.jugador ?? await User.findByPk(mejorJugadorId, {
    attributes: ['id', 'name', 'nick', 'photo'],
  });

  if (!jugador) {
    return null;
  }

  return {
    user_id: mejorJugadorId,
    puntos: mejorPuntaje,
    nombre: jugador.name || jugador.nick || 'Jugador',
    nick: jugador.nick ?? null,
    photo: jugador.photo ?? null,
    team_id: nomina?.team_id ?? null,
    equipo: nomina?.equipo
      ? {
          id: nomina.equipo.id,
          name: nomina.equipo.name,
          logo_url: nomina.equipo.logo_url,
        }
      : null,
  };
};

export const listarTarjetasPartido = async (
  partidoId,
  datetimePartido,
  { sportName = '', reglasSnapshot = null } = {}
) => {
  const esVoley = esVoleySport(sportName);
  const reglasVoley = resolverReglasVoley(reglasSnapshot);

  const eventos = await sequelize.query(
    `
    SELECT
      ep.id,
      ep.actor_principal_id,
      ep.detalle_json,
      ep.ocurrido_en_cliente,
      u.name AS jugador_nombre,
      u.nick AS jugador_nick
    FROM eventos_partido ep
    LEFT JOIN "user" u ON u.id = ep.actor_principal_id
    WHERE ep.partido_id = :partidoId
      AND ep.tipo_evento = 'SANCION'
      AND NOT EXISTS (
        SELECT 1
        FROM eventos_partido anul
        WHERE anul.partido_id = ep.partido_id
          AND anul.tipo_evento = 'ANULACION_EVENTO'
          AND anul.detalle_json->>'evento_anulado_id' = ep.id::text
      )
    ORDER BY ep.ocurrido_en_cliente ASC NULLS LAST, ep.secuencia_local ASC
    `,
    {
      replacements: { partidoId },
      type: QueryTypes.SELECT,
    }
  );

  const eventosValidos = filtrarEventosValidos(ordenarEventos(eventos));

  return eventos
    .map((evento) => {
      const tipo = evento.detalle_json?.tarjeta;
      if (tipo !== 'AMARILLA' && tipo !== 'ROJA') return null;

      const setNumero = esVoley
        ? resolverSetSancionVoley(evento, eventosValidos, reglasVoley)
        : null;

      return {
        evento_id: evento.id,
        jugador_id: evento.actor_principal_id,
        nombre: evento.jugador_nombre || evento.jugador_nick || 'Jugador',
        tipo,
        minuto: esVoley
          ? null
          : calcularMinuto(datetimePartido, evento.ocurrido_en_cliente),
        set_numero: setNumero,
      };
    })
    .filter(Boolean);
};

export const obtenerDetalleMarcadorPartido = async (partidoId) => {
  const partido = await Partidos.findByPk(partidoId, {
    attributes: [
      'id',
      'name',
      'torneo_id',
      'fase_torneo_id',
      'sport_id',
      'state',
      'datetime',
      'score_local_final',
      'score_visitante_final',
      'arbitro_asignado_id',
      'alineacion_local',
      'alineacion_visitante',
      'equipo_que_saca_inicial',
    ],
    include: [
      {
        model: FaseTorneo,
        as: 'faseTorneo',
        attributes: ['id', 'nombre', 'orden', 'tipo_formato'],
        required: false,
      },
      {
        model: MarcadoresDetalle,
        as: 'marcadorDetalle',
        required: false,
      },
      {
        model: Sports,
        as: 'sport',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: User,
        as: 'arbitro',
        attributes: ['id', 'name', 'nick', 'photo'],
        required: false,
      },
      {
        model: PartidoParticipantes,
        as: 'participantes',
        attributes: ['team_id', 'es_local'],
        include: [
          {
            model: Team,
            as: 'equipo',
            attributes: ['id', 'name', 'logo_url', 'capitan_id'],
          },
        ],
      },
    ],
  });

  if (!partido) {
    return null;
  }

  const partidoJson = partido.toJSON();
  const marcador = partidoJson.marcadorDetalle ?? null;
  delete partidoJson.marcadorDetalle;

  const participantes = partidoJson.participantes ?? [];
  const local = participantes.find((p) => p.es_local === true);
  const visitante = participantes.find((p) => p.es_local === false);

  let torneo = null;
  if (partidoJson.torneo_id) {
    const torneoRow = await Torneos.findByPk(partidoJson.torneo_id, {
      attributes: ['id', 'nombre'],
    });
    if (torneoRow) {
      torneo = { id: torneoRow.id, nombre: torneoRow.nombre };
    }
  }

  const parciales_sets = resolverParcialesSets(
    marcador,
    partidoJson.sport?.name
  );

  const tarjetas = await listarTarjetasPartido(partidoId, partidoJson.datetime, {
    sportName: partidoJson.sport?.name,
    reglasSnapshot: marcador?.reglas_arbitraje_snapshot ?? null,
  });

  const faseTorneo = partidoJson.faseTorneo
    ? {
        id: partidoJson.faseTorneo.id,
        nombre: partidoJson.faseTorneo.nombre,
        orden: partidoJson.faseTorneo.orden,
        tipo_formato: partidoJson.faseTorneo.tipo_formato,
        etiqueta: etiquetaFaseTorneo(partidoJson.faseTorneo),
      }
    : null;

  const mvp = esVoleySport(partidoJson.sport?.name)
    ? await calcularMvpPartido(partidoId)
    : null;

  const setActual = (parciales_sets?.length ?? 0) + 1;
  const reglasVoley = resolverReglasVoley(marcador?.reglas_arbitraje_snapshot ?? null);
  const historial_sustituciones = esVoleySport(partidoJson.sport?.name)
    ? await construirHistorialSustitucionesSet(
      partidoId,
      setActual,
      reglasVoley
    )
    : null;

  const cambios = esVoleySport(partidoJson.sport?.name)
    ? await construirListaCambiosPartido(partidoId, reglasVoley)
    : [];

  let cambiosEnriquecidos = [];
  if (cambios.length > 0) {
    const userIds = new Set();
    cambios.forEach((c) => {
      if (c.saliente_id != null) userIds.add(c.saliente_id);
      if (c.entrante_id != null) userIds.add(c.entrante_id);
    });

    const usuarios = await User.findAll({
      where: { id: [...userIds] },
      attributes: ['id', 'name', 'nick'],
    });
    const nombrePorId = new Map(
      usuarios.map((u) => [u.id, u.name || u.nick || `Jugador ${u.id}`])
    );

    cambiosEnriquecidos = cambios.map((c) => ({
      ...c,
      saliente_nombre: nombrePorId.get(c.saliente_id) ?? `Jugador ${c.saliente_id}`,
      entrante_nombre: nombrePorId.get(c.entrante_id) ?? `Jugador ${c.entrante_id}`,
    }));
  }

  return {
    partido: {
      id: partidoJson.id,
      name: partidoJson.name,
      datetime: partidoJson.datetime,
      state: partidoJson.state,
      score_local_final: partidoJson.score_local_final ?? marcador?.sets_ganados_local ?? 0,
      score_visitante_final: partidoJson.score_visitante_final ?? marcador?.sets_ganados_visitante ?? 0,
      sport: partidoJson.sport ?? null,
      torneo,
      fase_torneo: faseTorneo,
      arbitro: partidoJson.arbitro ?? null,
      equipo_local: local?.equipo
        ? {
            id: local.equipo.id,
            name: local.equipo.name,
            logo_url: local.equipo.logo_url,
            capitan_id: local.equipo.capitan_id,
          }
        : null,
      equipo_visitante: visitante?.equipo
        ? {
            id: visitante.equipo.id,
            name: visitante.equipo.name,
            logo_url: visitante.equipo.logo_url,
            capitan_id: visitante.equipo.capitan_id,
          }
        : null,
      equipo_local_id: local?.equipo?.id ?? null,
      equipo_local_nombre: local?.equipo?.name ?? null,
      equipo_visitante_id: visitante?.equipo?.id ?? null,
      equipo_visitante_nombre: visitante?.equipo?.name ?? null,
      alineacion_local: partidoJson.alineacion_local ?? null,
      alineacion_visitante: partidoJson.alineacion_visitante ?? null,
      equipo_que_saca_inicial: partidoJson.equipo_que_saca_inicial ?? null,
    },
    marcador: marcador
      ? {
          ...marcador,
          parciales_sets,
          metrica_estructura: {
            ...(marcador.metrica_estructura ?? {}),
            parciales_sets,
          },
        }
      : {
          parciales_sets,
          metrica_estructura: { parciales_sets },
        },
    tarjetas,
    mvp,
    historial_sustituciones,
    cambios: cambiosEnriquecidos,
  };
};
