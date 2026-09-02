import {
  Partidos,
  Torneos,
  FaseTorneo,
  PartidoJugadorStats,
} from '../db/db.js';

/**
 * Valida que la nómina no supere max_jugadores_equipo del torneo.
 */
export const validarMaxJugadoresEquipoTorneo = async (
  torneoId,
  cantidadJugadores,
  TorneosModel = Torneos
) => {
  if (!torneoId || cantidadJugadores == null) {
    return { ok: true };
  }

  const torneo = await TorneosModel.findByPk(torneoId, {
    attributes: ['id', 'max_jugadores_equipo'],
  });

  if (!torneo?.max_jugadores_equipo) {
    return { ok: true };
  }

  if (cantidadJugadores > torneo.max_jugadores_equipo) {
    return {
      ok: false,
      error: `La nómina no puede superar ${torneo.max_jugadores_equipo} jugadores para este torneo`,
    };
  }

  return { ok: true };
};

/**
 * Si el torneo lo exige, cada jugador debe tener stats en al menos un partido de fase de grupos.
 */
export const validarElegibilidadEliminatorias = async (
  partido,
  userIds,
  deps = {}
) => {
  const {
    Torneos: TorneosModel = Torneos,
    FaseTorneo: FaseTorneoModel = FaseTorneo,
    Partidos: PartidosModel = Partidos,
    PartidoJugadorStats: StatsModel = PartidoJugadorStats,
  } = deps;

  if (!partido?.torneo_id || !partido?.fase_torneo_id || !userIds?.length) {
    return { ok: true };
  }

  const torneo = await TorneosModel.findByPk(partido.torneo_id, {
    attributes: ['id', 'requiere_partido_grupos_para_eliminatoria'],
  });

  if (!torneo?.requiere_partido_grupos_para_eliminatoria) {
    return { ok: true };
  }

  const faseActual = await FaseTorneoModel.findByPk(partido.fase_torneo_id, {
    attributes: ['id', 'tipo_formato', 'orden'],
  });

  if (!faseActual || faseActual.tipo_formato !== 'ELIMINACION_DIRECTA') {
    return { ok: true };
  }

  const faseGrupos = await FaseTorneoModel.findOne({
    where: {
      torneo_id: partido.torneo_id,
      tipo_formato: 'GRUPOS_ELIMINATORIAS',
    },
    attributes: ['id'],
  });

  if (!faseGrupos) {
    return { ok: true };
  }

  const partidosGrupos = await PartidosModel.findAll({
    where: {
      torneo_id: partido.torneo_id,
      fase_torneo_id: faseGrupos.id,
    },
    attributes: ['id'],
  });

  const partidoIdsGrupos = partidosGrupos.map((p) => p.id);
  if (!partidoIdsGrupos.length) {
    return {
      ok: false,
      error: 'No hay partidos de fase de grupos para validar elegibilidad',
    };
  }

  const stats = await StatsModel.findAll({
    where: {
      user_id: userIds,
      partido_id: partidoIdsGrupos,
    },
    attributes: ['user_id'],
  });

  const conPartidoGrupos = new Set(stats.map((s) => s.user_id));
  const noElegibles = userIds.filter((uid) => !conPartidoGrupos.has(uid));

  if (noElegibles.length) {
    return {
      ok: false,
      error: `Los siguientes jugadores no tienen partido jugado en fase de grupos: ${noElegibles.join(', ')}`,
    };
  }

  return { ok: true };
};
