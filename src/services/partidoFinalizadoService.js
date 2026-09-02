import {
  Partidos,
  PartidoParticipantes,
  PartidoJugadorStats,
} from '../db/db.js';
import {
  resolverSportIdPartido,
  calcularStatsJugadorPartido,
  listarJugadoresNominaPartido,
  cargarEventosValidosPartido,
  cargarMapaValoresAccion,
} from './puntosPersonalesService.js';
import { actualizarFuerzaEquipoEnDataTeam } from './fuerzaEquipoService.js';
import { verificarYGenerarEliminatoriasTrasGrupos } from './generadorFixture.js';

/**
 * Persiste stats de jugadores y actualiza fuerza/ELO al cerrar un partido.
 * Idempotente en stats; el rating solo se mueve en la primera finalización.
 */
export const procesarPartidoFinalizado = async (
  partidoId,
  transaction = null,
  options = {}
) => {
  const { actualizarRating = true } = options;
  const partido = await Partidos.findByPk(partidoId, {
    attributes: ['id', 'state', 'sport_id', 'torneo_id'],
    transaction,
  });

  if (!partido || partido.state !== 'FINALIZADO') {
    return { procesado: false, motivo: 'partido_no_finalizado' };
  }

  const sportId = await resolverSportIdPartido(partidoId, transaction);
  if (!sportId) {
    return { procesado: false, motivo: 'sport_id_no_resuelto' };
  }

  const eventosValidos = await cargarEventosValidosPartido(partidoId, transaction);
  const mapaValores = await cargarMapaValoresAccion(sportId, transaction);
  const jugadores = await listarJugadoresNominaPartido(partidoId, transaction);

  await PartidoJugadorStats.destroy({
    where: { partido_id: partidoId },
    transaction,
  });

  const statsPayloads = await Promise.all(
    jugadores.map((nomina) => calcularStatsJugadorPartido(
      partidoId,
      nomina.user_id,
      nomina.team_id,
      { transaction, sportId, eventosValidos, mapaValores }
    ))
  );

  if (statsPayloads.length) {
    await PartidoJugadorStats.bulkCreate(statsPayloads, { transaction });
  }

  const resultadoPrincipal = await resolverResultadoPrincipalPartido(
    partidoId,
    transaction
  );

  let rating = null;
  if (actualizarRating) {
    rating = await actualizarRatingEquiposPartido(
      partidoId,
      resultadoPrincipal,
      transaction
    );
  }

  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partidoId },
    attributes: ['team_id'],
    transaction,
  });

  const teamIds = [...new Set(participantes.map((p) => p.team_id).filter(Boolean))];
  const fuerzas = {};

  for (const teamId of teamIds) {
    fuerzas[teamId] = await actualizarFuerzaEquipoEnDataTeam(
      teamId,
      sportId,
      transaction
    );
  }

  let eliminatorias = null;
  if (partido.torneo_id) {
    eliminatorias = await verificarYGenerarEliminatoriasTrasGrupos(partido.torneo_id);
  }

  return {
    procesado: true,
    partido_id: partidoId,
    sport_id: sportId,
    jugadores_procesados: statsPayloads.length,
    rating,
    fuerzas,
    eliminatorias,
  };
};

export default procesarPartidoFinalizado;
