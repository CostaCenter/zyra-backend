/**
 * MOMENTO 2 — Recalculación en vivo del horario tras finalizar un partido.
 *
 * Se invoca desde partidoFinalizadoService cuando un partido pasa a FINALIZADO.
 * Compara hora real vs fin estimado; si el desfase supera el umbral, reprograma
 * partidos pendientes del mismo torneo.
 */

import {
  Partidos,
  PartidoParticipantes,
  Torneos,
} from '../db/db.js';
import { obtenerConfigLogistica, UMBRAL_DESFASE_RECALCULO_MINUTOS } from './torneoConfigService.js';
import {
  calcularDesfaseFinalizacionMinutos,
  esPartidoHorarioFijo,
  esPartidoProgramable,
  reprogramarPartidosPendientes,
} from './programacionPartidosService.js';

const cargarEquiposPorPartido = async (partidoIds, transaction = null) => {
  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partidoIds },
    attributes: ['partido_id', 'team_id', 'es_local'],
    transaction,
  });

  const mapa = new Map();
  for (const row of participantes) {
    const id = row.partido_id;
    if (!mapa.has(id)) mapa.set(id, { local: null, visitante: null });
    const entry = mapa.get(id);
    if (row.es_local) entry.local = row.team_id;
    else entry.visitante = row.team_id;
  }

  return mapa;
};

const serializarPartidoProgramacion = (partido, equiposMap) => {
  const eq = equiposMap.get(partido.id) ?? {};
  return {
    id: partido.id,
    jornada: partido.jornada,
    state: partido.state,
    datetime: partido.datetime,
    cancha_id: partido.cancha_id,
    duracion_programada_minutos: partido.duracion_programada_minutos,
    equipos: [eq.local, eq.visitante].filter(Boolean),
    finRealMs: partido.finalizado_en
      ? new Date(partido.finalizado_en).getTime()
      : undefined,
  };
};

export const evaluarYRecalcularHorarioTrasFinalizar = async (
  partidoId,
  finalizadoEn = new Date(),
  transaction = null
) => {
  const partidoFinalizado = await Partidos.findByPk(partidoId, {
    attributes: [
      'id',
      'torneo_id',
      'datetime',
      'duracion_programada_minutos',
      'state',
      'finalizado_en',
    ],
    transaction,
  });

  if (!partidoFinalizado?.torneo_id || partidoFinalizado.state !== 'FINALIZADO') {
    return { recalculado: false, motivo: 'partido_no_aplicable' };
  }

  const desfaseMinutos = Math.abs(calcularDesfaseFinalizacionMinutos(
    partidoFinalizado,
    finalizadoEn
  ));

  if (desfaseMinutos < UMBRAL_DESFASE_RECALCULO_MINUTOS) {
    return { recalculado: false, desfaseMinutos, motivo: 'desfase_insuficiente' };
  }

  const torneo = await Torneos.findByPk(partidoFinalizado.torneo_id, { transaction });
  if (!torneo) {
    return { recalculado: false, motivo: 'torneo_no_encontrado' };
  }

  const config = obtenerConfigLogistica(torneo);
  const todosPartidos = await Partidos.findAll({
    where: { torneo_id: torneo.id },
    attributes: [
      'id',
      'jornada',
      'state',
      'datetime',
      'cancha_id',
      'duracion_programada_minutos',
      'finalizado_en',
    ],
    order: [['jornada', 'ASC'], ['id', 'ASC']],
    transaction,
  });

  const ids = todosPartidos.map((p) => p.id);
  const equiposMap = await cargarEquiposPorPartido(ids, transaction);

  const partidosFijos = [];
  const partidosPendientes = [];

  for (const p of todosPartidos) {
    const serializado = serializarPartidoProgramacion(p, equiposMap);
    if (p.id === partidoFinalizado.id) {
      serializado.finRealMs = new Date(finalizadoEn).getTime();
      partidosFijos.push(serializado);
    } else if (esPartidoHorarioFijo(p.state)) {
      partidosFijos.push(serializado);
    } else if (esPartidoProgramable(p.state)) {
      partidosPendientes.push(serializado);
    }
  }

  if (!partidosPendientes.length) {
    return { recalculado: false, desfaseMinutos, motivo: 'sin_pendientes' };
  }

  const horaInicioDesde = new Date(Math.max(
    Date.now(),
    new Date(finalizadoEn).getTime()
  ));

  const resultado = reprogramarPartidosPendientes(
    partidosPendientes,
    partidosFijos,
    {
      fechaInicio: config.fecha_hora_inicio,
      fechaFin: config.fecha_fin,
      tipoDuracion: config.tipo_duracion,
      horaInicioDiaria: config.hora_inicio_diaria,
      horaFinDiaria: config.hora_fin_diaria,
      duracionPartidoMinutos: config.duracion_partido_programacion_minutos,
      numeroCanchas: config.numero_canchas,
      descansoMinimoMinutos: config.descanso_minimo_entre_partidos_minutos,
    },
    horaInicioDesde
  );

  if (resultado.error) {
    return { recalculado: false, desfaseMinutos, error: resultado.error };
  }

  const cambios = [];

  for (const asignacion of resultado.asignaciones) {
    const anterior = todosPartidos.find((p) => p.id === asignacion.partidoId);
    const datetimeAnterior = anterior?.datetime ? new Date(anterior.datetime).toISOString() : null;
    const datetimeNuevo = asignacion.datetime.toISOString();

    if (datetimeAnterior !== datetimeNuevo || anterior?.cancha_id !== asignacion.cancha_id) {
      cambios.push({
        partido_id: asignacion.partidoId,
        datetime_anterior: datetimeAnterior,
        datetime_nuevo: datetimeNuevo,
        cancha_anterior: anterior?.cancha_id ?? null,
        cancha_nueva: asignacion.cancha_id,
      });
    }

    await Partidos.update(
      {
        datetime: asignacion.datetime,
        cancha_id: asignacion.cancha_id,
        duracion_programada_minutos: asignacion.duracion_programada_minutos,
      },
      { where: { id: asignacion.partidoId }, transaction }
    );
  }

  if (cambios.length) {
    const resumen = {
      mensaje: 'Horario actualizado',
      partidos_modificados: cambios.length,
      cambios,
      desfase_minutos: desfaseMinutos,
      partido_disparador_id: partidoFinalizado.id,
    };

    await torneo.update(
      {
        horario_actualizado_en: new Date(),
        horario_actualizado_resumen: resumen,
      },
      { transaction }
    );
  }

  return {
    recalculado: cambios.length > 0,
    desfaseMinutos,
    cambios,
  };
};

export const obtenerEstadoHorarioTorneo = async (torneoId) => {
  const torneo = await Torneos.findByPk(torneoId, {
    attributes: ['id', 'horario_actualizado_en', 'horario_actualizado_resumen'],
  });

  if (!torneo) return null;

  return {
    horario_actualizado_en: torneo.horario_actualizado_en,
    horario_actualizado: Boolean(torneo.horario_actualizado_en),
    resumen: torneo.horario_actualizado_resumen ?? null,
    mensaje: torneo.horario_actualizado_en ? 'Horario actualizado' : null,
  };
};
