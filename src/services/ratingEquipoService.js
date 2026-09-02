import {
  Partidos,
  PartidoParticipantes,
  DataTeam,
  EventosPartido,
} from '../db/db.js';
import { ordenarEventos, filtrarEventosValidos } from './reducerPartido.js';

export const ELO_EQUIPO_DEFAULT = 150;
export const K_ELO_BASE = 24;
export const K_ELO_MAX = 60;

const expectedScore = (eloA, eloB) =>
  1 / (1 + 10 ** ((eloB - eloA) / 400));

/**
 * Mayor margen de puntos totales → mayor movimiento de rating.
 */
export const calcularFactorMargen = (margenPuntos) => {
  const margen = Math.max(0, margenPuntos ?? 0);
  return Math.min(2.5, 1 + (Math.log1p(margen) / Math.log(26)));
};

export const calcularDeltaElo = (eloGanador, eloPerdedor, margenPuntos) => {
  const k = K_ELO_BASE * calcularFactorMargen(margenPuntos);
  const esperado = expectedScore(eloGanador, eloPerdedor);
  return Math.round(k * (1 - esperado));
};

export const contarPuntosTotalesPartido = async (partidoId, transaction = null) => {
  const eventos = await EventosPartido.findAll({
    where: { partido_id: partidoId },
    transaction,
  });

  const validos = filtrarEventosValidos(ordenarEventos(eventos.map((e) => e.toJSON())));

  let local = 0;
  let visitante = 0;

  for (const evento of validos) {
    if (evento.tipo_evento !== 'PUNTO') continue;
    const equipo = evento.detalle_json?.equipo;
    if (equipo === 'LOCAL') local += 1;
    if (equipo === 'VISITANTE') visitante += 1;
  }

  return { local, visitante, margen: Math.abs(local - visitante) };
};

const asegurarDataTeam = async (teamId, transaction) => {
  const [registro] = await DataTeam.findOrCreate({
    where: { team_id: teamId },
    defaults: {
      team_id: teamId,
      elo: ELO_EQUIPO_DEFAULT,
      games: 0,
      win: 0,
      lose: 0,
      draw: 0,
      total: 0,
    },
    transaction,
  });
  return registro;
};

/**
 * Actualiza ELO y récord en DataTeam según resultado y margen de puntos totales.
 */
export const actualizarRatingEquiposPartido = async (
  partidoId,
  resultadoPrincipal,
  transaction = null
) => {
  if (!resultadoPrincipal || resultadoPrincipal === 0) {
    return null;
  }

  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partidoId },
    attributes: ['team_id', 'es_local'],
    transaction,
  });

  const local = participantes.find((p) => p.es_local === true);
  const visitante = participantes.find((p) => p.es_local === false);

  if (!local?.team_id || !visitante?.team_id) {
    return null;
  }

  const { margen } = await contarPuntosTotalesPartido(partidoId, transaction);

  const ganoLocal = resultadoPrincipal === 1;
  const teamGanadorId = ganoLocal ? local.team_id : visitante.team_id;
  const teamPerdedorId = ganoLocal ? visitante.team_id : local.team_id;

  const dataGanador = await asegurarDataTeam(teamGanadorId, transaction);
  const dataPerdedor = await asegurarDataTeam(teamPerdedorId, transaction);

  const eloGanador = dataGanador.elo ?? ELO_EQUIPO_DEFAULT;
  const eloPerdedor = dataPerdedor.elo ?? ELO_EQUIPO_DEFAULT;

  const delta = Math.min(
    calcularDeltaElo(eloGanador, eloPerdedor, margen),
    K_ELO_MAX
  );

  await dataGanador.update({
    elo: eloGanador + delta,
    games: (dataGanador.games ?? 0) + 1,
    win: (dataGanador.win ?? 0) + 1,
    total: (dataGanador.total ?? 0) + 1,
  }, { transaction });

  await dataPerdedor.update({
    elo: Math.max(0, eloPerdedor - delta),
    games: (dataPerdedor.games ?? 0) + 1,
    lose: (dataPerdedor.lose ?? 0) + 1,
    total: (dataPerdedor.total ?? 0) + 1,
  }, { transaction });

  return {
    team_ganador_id: teamGanadorId,
    team_perdedor_id: teamPerdedorId,
    delta_elo: delta,
    margen_puntos: margen,
  };
};

export const resolverResultadoPrincipalPartido = async (partidoId, transaction = null) => {
  const partido = await Partidos.findByPk(partidoId, {
    attributes: ['score_local_final', 'score_visitante_final'],
    transaction,
  });

  if (!partido) return 0;

  const local = partido.score_local_final ?? 0;
  const visitante = partido.score_visitante_final ?? 0;

  if (local === visitante) return 0;
  return local > visitante ? 1 : -1;
};
