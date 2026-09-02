import { Op } from 'sequelize';
import {
  sequelize,
  FaseTorneo,
  Torneos,
  TorneoInscripcion,
  GrupoEquipos,
  GrupoDivision,
  Partidos,
  PartidoParticipantes,
  ProgresionFixture
} from '../db/db.js';
import {
  fisherYatesShuffle,
  mezclarEquiposSorteo,
  sorteoEliminacionDirecta,
  construirEntradaOrdenSorteo,
  fusionarOrdenSorteo,
} from '../utils/sorteoAleatorio.js';
import { programarPartidosGreedy } from './programacionPartidosService.js';
import { obtenerConfigLogistica } from './torneoConfigService.js';
import {
  nombreGrupoPorIndice,
  repartirEquiposEnGrupos,
  construirSlotsEliminatoriasDesdeGrupos,
  extraerClasificadosDePosiciones,
} from './gruposEliminatoriasService.js';

export { fisherYatesShuffle } from '../utils/sorteoAleatorio.js';

export const getDefaultDeps = () => ({
  FaseTorneo,
  Torneos,
  TorneoInscripcion,
  GrupoEquipos,
  GrupoDivision,
  Partidos,
  PartidoParticipantes,
  ProgresionFixture,
  sequelize,
});

export const calcularTamanoBracket = (cantidadEquipos) => {
  let tamano = 1;
  while (tamano < cantidadEquipos) {
    tamano *= 2;
  }
  return tamano;
};

/**
 * Coloca equipos en posiciones aleatorias del bracket; slots vacíos = bye.
 * @deprecated Preferir sorteoEliminacionDirecta en producción.
 */
export const asignarSlotsEnBracket = (teamIds, tamanoBracket, random = Math.random) => {
  const equiposMezclados = fisherYatesShuffle(teamIds, random);
  const posiciones = fisherYatesShuffle(
    Array.from({ length: tamanoBracket }, (_, index) => index),
    random
  );
  const slots = Array(tamanoBracket).fill(null);

  equiposMezclados.forEach((teamId, index) => {
    slots[posiciones[index]] = teamId;
  });

  return slots;
};

const persistirOrdenSorteo = async (
  torneoId,
  entrada,
  TorneosModel,
  transaction
) => {
  const torneo = await TorneosModel.findByPk(torneoId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
    attributes: ['id', 'orden_sorteo'],
  });

  if (!torneo) {
    throw new Error('Torneo no encontrado al registrar orden de sorteo');
  }

  const ordenActualizado = fusionarOrdenSorteo(torneo.orden_sorteo, entrada);
  await torneo.update({ orden_sorteo: ordenActualizado }, { transaction });

  return ordenActualizado;
};

const serializarPartido = (partido) =>
  typeof partido?.toJSON === 'function' ? partido.toJSON() : partido;

const posicionDestinoEnRonda = (indiceEnRonda) =>
  indiceEnRonda % 2 === 0 ? 'LOCAL' : 'VISITANTE';

const crearPayloadPartido = (fase, faseTorneoId, torneo, state = 'PROGRAMADO') => ({
  torneo_id: fase.torneo_id,
  fase_torneo_id: faseTorneoId,
  sport_id: torneo.sport_id,
  state,
  nivel_arbitraje: torneo.nivel_arbitraje_default
});

export const cargarFaseYValidarFixture = async (
  faseTorneoId,
  deps,
  { grupoDivisionId = null, bloquearPorFaseCompleta = false } = {}
) => {
  const { FaseTorneo: FaseTorneoModel, Torneos: TorneosModel, Partidos: PartidosModel } = deps;

  const fase = await FaseTorneoModel.findByPk(faseTorneoId, {
    include: [
      {
        model: TorneosModel,
        as: 'torneo',
        attributes: [
          'id',
          'sport_id',
          'nivel_arbitraje_default',
          'fecha_hora_inicio',
          'fecha_fin',
          'tipo_duracion',
          'hora_inicio_diaria',
          'hora_fin_diaria',
          'descanso_minimo_minutos',
          'duracion_promedio_set_minutos',
          'descanso_entre_sets_minutos',
          'reglas_arbitraje_json',
          'numero_canchas',
        ],
      }
    ]
  });

  if (!fase) {
    return { error: 'Fase no encontrada' };
  }

  const where = { fase_torneo_id: faseTorneoId };
  let mensajeDuplicado = 'Ya existe fixture generado para esta fase';

  if (bloquearPorFaseCompleta) {
    // Eliminación directa: la fase completa es un solo bracket.
  } else if (grupoDivisionId !== null) {
    where.grupo_division_id = grupoDivisionId;
    mensajeDuplicado = 'Ya existe fixture generado para este grupo';
  } else {
    where.grupo_division_id = null;
  }

  const partidosExistentes = await PartidosModel.count({ where });

  if (partidosExistentes > 0) {
    return { error: mensajeDuplicado };
  }

  return { fase, torneo: fase.torneo };
};

export const obtenerEquiposAceptados = async (torneoId, TorneoInscripcionModel) => {
  const inscripciones = await TorneoInscripcionModel.findAll({
    where: {
      torneo_id: torneoId,
      estado: 'ACEPTADA'
    },
    attributes: ['team_id']
  });

  return [...new Set(inscripciones.map((inscripcion) => inscripcion.team_id))];
};

export const obtenerEquiposDelGrupo = async (grupoDivisionId, GrupoEquiposModel) => {
  const asignaciones = await GrupoEquiposModel.findAll({
    where: { grupo_division_id: grupoDivisionId },
    attributes: ['team_id']
  });

  return [...new Set(asignaciones.map((asignacion) => asignacion.team_id))];
};

/**
 * Genera jornadas con el método del círculo (circle method).
 * Con N par: N-1 jornadas, N/2 partidos por jornada.
 * Con N impar: se añade un bye; un equipo descansa por jornada.
 *
 * @returns {Array<Array<[number, number]>>} jornadas de pares [local, visitante]
 */
export const generarJornadasCircleMethod = (teamIds) => {
  if (teamIds.length < 2) {
    return [];
  }

  const equipos = [...teamIds];
  if (equipos.length % 2 === 1) {
    equipos.push(null);
  }

  const n = equipos.length;
  const numJornadas = n - 1;
  const jornadas = [];
  let rotacion = equipos.slice(1);

  for (let j = 0; j < numJornadas; j += 1) {
    const fila = [equipos[0], ...rotacion];
    const partidosJornada = [];

    for (let i = 0; i < n / 2; i += 1) {
      const local = fila[i];
      const visitante = fila[n - 1 - i];

      if (local != null && visitante != null) {
        partidosJornada.push([local, visitante]);
      }
    }

    jornadas.push(partidosJornada);
    rotacion = [rotacion[rotacion.length - 1], ...rotacion.slice(0, -1)];
  }

  return jornadas;
};

/**
 * @deprecated Usar generarJornadasCircleMethod. Mantenido para tests legacy.
 */
export const generarParesRoundRobin = (teamIds) => {
  const pares = [];

  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = i + 1; j < teamIds.length; j += 1) {
      pares.push([teamIds[i], teamIds[j]]);
    }
  }

  return pares;
};

/**
 * Genera fixture TODOS_CONTRA_TODOS para una fase de torneo.
 */
export const generarRoundRobin = async (
  faseTorneoId,
  grupoDivisionId = null,
  deps = getDefaultDeps(),
  { omitirProgramacion = false } = {}
) => {
  const {
    TorneoInscripcion: TorneoInscripcionModel,
    GrupoEquipos: GrupoEquiposModel,
    Partidos: PartidosModel,
    PartidoParticipantes: PartidoParticipantesModel,
    Torneos: TorneosModel,
    sequelize: sequelizeInstance,
    mezclarEquiposSorteo: mezclarCustom,
  } = deps;

  const validacion = await cargarFaseYValidarFixture(faseTorneoId, deps, { grupoDivisionId });
  if (validacion.error) {
    return { error: validacion.error };
  }

  const { fase, torneo } = validacion;

  const teamIds = grupoDivisionId !== null
    ? await obtenerEquiposDelGrupo(grupoDivisionId, GrupoEquiposModel)
    : await obtenerEquiposAceptados(fase.torneo_id, TorneoInscripcionModel);

  if (teamIds.length < 2) {
    return { error: 'Se necesitan al menos 2 equipos para generar fixture' };
  }

  const teamIdsEntrada = [...teamIds];
  const mezclar = mezclarCustom ?? mezclarEquiposSorteo;
  const sorteo = mezclar(teamIdsEntrada);
  const teamIdsSorteo = sorteo.equipos;
  const jornadas = generarJornadasCircleMethod(teamIdsSorteo);

  const entradaSorteo = construirEntradaOrdenSorteo({
    faseTorneoId,
    grupoDivisionId,
    tipoFormato: 'TODOS_CONTRA_TODOS',
    teamIdsEntrada,
    teamIdsSorteo,
    semillaHex: sorteo.semilla_hex,
  });

  const partidosCreados = await sequelizeInstance.transaction(async (transaction) => {
    const creados = [];

    for (let indiceJornada = 0; indiceJornada < jornadas.length; indiceJornada += 1) {
      const numeroJornada = indiceJornada + 1;
      const partidosJornada = jornadas[indiceJornada];

      for (const [equipoLocalId, equipoVisitanteId] of partidosJornada) {
        const partido = await PartidosModel.create(
          {
            ...crearPayloadPartido(fase, faseTorneoId, torneo),
            grupo_division_id: grupoDivisionId,
            jornada: numeroJornada
          },
          { transaction }
        );

        await PartidoParticipantesModel.create(
          {
            partido_id: partido.id,
            team_id: equipoLocalId,
            es_local: true
          },
          { transaction }
        );

        await PartidoParticipantesModel.create(
          {
            partido_id: partido.id,
            team_id: equipoVisitanteId,
            es_local: false
          },
          { transaction }
        );

        creados.push(partido);
      }
    }

    const ordenSorteo = await persistirOrdenSorteo(
      fase.torneo_id,
      entradaSorteo,
      TorneosModel,
      transaction
    );

    return { creados, ordenSorteo };
  });

  if (omitirProgramacion) {
    return {
      partidos: partidosCreados.creados.map(serializarPartido),
      partidosModelos: partidosCreados.creados,
      orden_sorteo: partidosCreados.ordenSorteo,
      sorteo: entradaSorteo,
      programacion: null,
      programacion_error: null,
    };
  }

  const torneoCompleto = await TorneosModel.findByPk(fase.torneo_id);
  const programacion = await aplicarProgramacionPartidos(
    partidosCreados.creados,
    torneoCompleto ?? torneo,
    deps
  );

  return {
    partidos: partidosCreados.creados.map(serializarPartido),
    orden_sorteo: partidosCreados.ordenSorteo,
    sorteo: entradaSorteo,
    programacion: programacion.asignaciones ?? null,
    programacion_error: programacion.error ?? null,
  };
};

/**
 * Genera la estructura completa de bracket para ELIMINACION_DIRECTA.
 */
export const generarEliminacionDirecta = async (
  faseTorneoId,
  deps = getDefaultDeps()
) => {
  const {
    TorneoInscripcion: TorneoInscripcionModel,
    Partidos: PartidosModel,
    PartidoParticipantes: PartidoParticipantesModel,
    ProgresionFixture: ProgresionFixtureModel,
    Torneos: TorneosModel,
    sequelize: sequelizeInstance,
    sorteoEliminacionDirecta: sorteoCustom,
    asignarSlotsEnBracket: asignarSlotsCustom,
    random,
  } = deps;

  const validacion = await cargarFaseYValidarFixture(faseTorneoId, deps, {
    bloquearPorFaseCompleta: true
  });
  if (validacion.error) {
    return { error: validacion.error };
  }

  const { fase, torneo } = validacion;
  const teamIds = await obtenerEquiposAceptados(fase.torneo_id, TorneoInscripcionModel);

  if (teamIds.length < 2) {
    return { error: 'Se necesitan al menos 2 equipos para generar fixture' };
  }

  const tamanoBracket = calcularTamanoBracket(teamIds.length);
  const totalRondas = Math.log2(tamanoBracket);
  const teamIdsEntrada = [...teamIds];

  let slots;
  let entradaSorteo;

  if (sorteoCustom) {
    const sorteo = sorteoCustom(teamIdsEntrada, tamanoBracket);
    slots = sorteo.slots;
    entradaSorteo = construirEntradaOrdenSorteo({
      faseTorneoId,
      grupoDivisionId: null,
      tipoFormato: 'ELIMINACION_DIRECTA',
      teamIdsEntrada,
      teamIdsSorteo: sorteo.equiposMezclados,
      semillaHex: sorteo.semilla_hex,
      slots: sorteo.slots,
    });
  } else if (asignarSlotsCustom || random) {
    const asignarSlots = asignarSlotsCustom
      ?? ((equipos, tamano) => asignarSlotsEnBracket(equipos, tamano, random ?? Math.random));
    slots = asignarSlots(teamIdsEntrada, tamanoBracket);
    entradaSorteo = construirEntradaOrdenSorteo({
      faseTorneoId,
      grupoDivisionId: null,
      tipoFormato: 'ELIMINACION_DIRECTA',
      teamIdsEntrada,
      teamIdsSorteo: teamIdsEntrada,
      semillaHex: null,
      slots,
    });
  } else {
    const sorteo = sorteoEliminacionDirecta(teamIdsEntrada, tamanoBracket);
    slots = sorteo.slots;
    entradaSorteo = construirEntradaOrdenSorteo({
      faseTorneoId,
      grupoDivisionId: null,
      tipoFormato: 'ELIMINACION_DIRECTA',
      teamIdsEntrada,
      teamIdsSorteo: sorteo.equiposMezclados,
      semillaHex: sorteo.semilla_hex,
      slots: sorteo.slots,
    });
  }

  const resultado = await sequelizeInstance.transaction(async (transaction) => {
    const partidosPorRonda = {};
    const progresiones = [];

    for (let ronda = 1; ronda <= totalRondas; ronda += 1) {
      partidosPorRonda[ronda] = [];
      const partidosEnRonda = tamanoBracket / (2 ** ronda);

      for (let indicePartido = 0; indicePartido < partidosEnRonda; indicePartido += 1) {
        if (ronda === 1) {
          const indiceFeed = indicePartido;
          const equipoLocal = slots[indiceFeed * 2];
          const equipoVisitante = slots[indiceFeed * 2 + 1];

          if (equipoLocal && equipoVisitante) {
            const partido = await PartidosModel.create(
              crearPayloadPartido(fase, faseTorneoId, torneo),
              { transaction }
            );

            await PartidoParticipantesModel.create(
              {
                partido_id: partido.id,
                team_id: equipoLocal,
                es_local: true
              },
              { transaction }
            );

            await PartidoParticipantesModel.create(
              {
                partido_id: partido.id,
                team_id: equipoVisitante,
                es_local: false
              },
              { transaction }
            );

            partidosPorRonda[1].push(partido);
          } else {
            partidosPorRonda[1].push(null);
          }
        } else {
          const partido = await PartidosModel.create(
            crearPayloadPartido(fase, faseTorneoId, torneo),
            { transaction }
          );
          partidosPorRonda[ronda].push(partido);
        }
      }
    }

    for (let indiceFeed = 0; indiceFeed < tamanoBracket / 2; indiceFeed += 1) {
      const equipoLocal = slots[indiceFeed * 2];
      const equipoVisitante = slots[indiceFeed * 2 + 1];
      const partidoR1 = partidosPorRonda[1][indiceFeed];

      if (totalRondas === 1) {
        continue;
      }

      if (partidoR1) {
        const indiceDestinoR2 = Math.floor(indiceFeed / 2);
        const partidoDestino = partidosPorRonda[2][indiceDestinoR2];

        progresiones.push(
          await ProgresionFixtureModel.create(
            {
              torneo_id: fase.torneo_id,
              partido_origen_id: partidoR1.id,
              partido_destino_id: partidoDestino.id,
              condicion_avance: 'GANADOR',
              posicion_destino: posicionDestinoEnRonda(indiceFeed)
            },
            { transaction }
          )
        );
      } else if (equipoLocal || equipoVisitante) {
        const teamId = equipoLocal || equipoVisitante;
        const indiceDestinoR2 = Math.floor(indiceFeed / 2);
        const partidoDestino = partidosPorRonda[2][indiceDestinoR2];
        const esLocal = posicionDestinoEnRonda(indiceFeed) === 'LOCAL';

        await PartidoParticipantesModel.create(
          {
            partido_id: partidoDestino.id,
            team_id: teamId,
            es_local: esLocal
          },
          { transaction }
        );
      }
    }

    for (let ronda = 2; ronda < totalRondas; ronda += 1) {
      for (let indicePartido = 0; indicePartido < partidosPorRonda[ronda].length; indicePartido += 1) {
        const partidoOrigen = partidosPorRonda[ronda][indicePartido];
        const indiceDestino = Math.floor(indicePartido / 2);
        const partidoDestino = partidosPorRonda[ronda + 1][indiceDestino];

        progresiones.push(
          await ProgresionFixtureModel.create(
            {
              torneo_id: fase.torneo_id,
              partido_origen_id: partidoOrigen.id,
              partido_destino_id: partidoDestino.id,
              condicion_avance: 'GANADOR',
              posicion_destino: posicionDestinoEnRonda(indicePartido)
            },
            { transaction }
          )
        );
      }
    }

    const todosLosPartidos = Object.values(partidosPorRonda)
      .flat()
      .filter(Boolean);

    const ordenSorteo = await persistirOrdenSorteo(
      fase.torneo_id,
      entradaSorteo,
      TorneosModel,
      transaction
    );

    return {
      partidos: todosLosPartidos,
      progresiones,
      ordenSorteo,
    };
  });

  const torneoCompleto = await TorneosModel.findByPk(fase.torneo_id);
  const programacion = await aplicarProgramacionPartidos(
    resultado.partidos,
    torneoCompleto ?? torneo,
    deps
  );

  return {
    partidos: resultado.partidos.map(serializarPartido),
    progresiones: resultado.progresiones.map(serializarPartido),
    tamanoBracket,
    byes: tamanoBracket - teamIds.length,
    orden_sorteo: resultado.ordenSorteo,
    sorteo: entradaSorteo,
    programacion: programacion.asignaciones ?? null,
    programacion_error: programacion.error ?? null,
  };
};

const cargarParticipantesPorPartido = async (partidoIds, PartidoParticipantesModel) => {
  if (!partidoIds.length) return new Map();

  const participantes = await PartidoParticipantesModel.findAll({
    where: { partido_id: partidoIds },
    attributes: ['partido_id', 'team_id', 'es_local'],
  });

  const mapa = new Map();
  for (const p of participantes) {
    if (!mapa.has(p.partido_id)) {
      mapa.set(p.partido_id, { local: null, visitante: null });
    }
    const entry = mapa.get(p.partido_id);
    if (p.es_local) entry.local = p.team_id;
    else entry.visitante = p.team_id;
  }
  return mapa;
};

/**
 * Asigna datetime y cancha_id a partidos recién creados (greedy).
 */
export const aplicarProgramacionPartidos = async (
  partidos,
  torneo,
  deps = getDefaultDeps(),
  transaction = null
) => {
  const { Partidos: PartidosModel, PartidoParticipantes: PartidoParticipantesModel } = deps;
  const config = obtenerConfigLogistica(torneo);
  const partidoIds = partidos.map((p) => p.id ?? p);
  const participantesMap = await cargarParticipantesPorPartido(
    partidoIds,
    PartidoParticipantesModel
  );

  const payloadProgramacion = partidos.map((partido) => {
    const id = partido.id ?? partido;
    const participantes = participantesMap.get(id) ?? {};
    return {
      id,
      jornada: partido.jornada ?? partido.ronda ?? 0,
      equipos: [participantes.local, participantes.visitante].filter(Boolean),
    };
  });

  /** MOMENTO 1 — duración con margen + descanso entre partidos automático. */
  const resultado = programarPartidosGreedy(payloadProgramacion, {
    fechaInicio: config.fecha_hora_inicio,
    fechaFin: config.fecha_fin,
    tipoDuracion: config.tipo_duracion,
    horaInicioDiaria: config.hora_inicio_diaria,
    horaFinDiaria: config.hora_fin_diaria,
    duracionPartidoMinutos: config.duracion_partido_programacion_minutos,
    numeroCanchas: config.numero_canchas,
    descansoMinimoMinutos: config.descanso_minimo_entre_partidos_minutos,
  });

  if (resultado.error) {
    return { error: resultado.error, asignacionesParciales: resultado.asignacionesParciales };
  }

  for (const asignacion of resultado.asignaciones) {
    await PartidosModel.update(
      {
        datetime: asignacion.datetime,
        cancha_id: asignacion.cancha_id,
        duracion_programada_minutos: asignacion.duracion_programada_minutos,
      },
      {
        where: { id: asignacion.partidoId },
        transaction,
      }
    );
  }

  return { asignaciones: resultado.asignaciones };
};

const crearBracketEliminacionConSlots = async (
  fase,
  faseTorneoId,
  torneo,
  slots,
  deps,
  transaction
) => {
  const {
    Partidos: PartidosModel,
    PartidoParticipantes: PartidoParticipantesModel,
    ProgresionFixture: ProgresionFixtureModel,
  } = deps;

  const tamanoBracket = slots.length;
  const totalRondas = Math.log2(tamanoBracket);
  const partidosPorRonda = {};
  const progresiones = [];

  for (let ronda = 1; ronda <= totalRondas; ronda += 1) {
    partidosPorRonda[ronda] = [];
    const partidosEnRonda = tamanoBracket / (2 ** ronda);

    for (let indicePartido = 0; indicePartido < partidosEnRonda; indicePartido += 1) {
      if (ronda === 1) {
        const indiceFeed = indicePartido;
        const equipoLocal = slots[indiceFeed * 2];
        const equipoVisitante = slots[indiceFeed * 2 + 1];

        if (equipoLocal && equipoVisitante) {
          const partido = await PartidosModel.create(
            crearPayloadPartido(fase, faseTorneoId, torneo),
            { transaction }
          );

          await PartidoParticipantesModel.create(
            { partido_id: partido.id, team_id: equipoLocal, es_local: true },
            { transaction }
          );
          await PartidoParticipantesModel.create(
            { partido_id: partido.id, team_id: equipoVisitante, es_local: false },
            { transaction }
          );

          partidosPorRonda[1].push(partido);
        } else {
          partidosPorRonda[1].push(null);
        }
      } else {
        const partido = await PartidosModel.create(
          crearPayloadPartido(fase, faseTorneoId, torneo),
          { transaction }
        );
        partidosPorRonda[ronda].push(partido);
      }
    }
  }

  for (let indiceFeed = 0; indiceFeed < tamanoBracket / 2; indiceFeed += 1) {
    const equipoLocal = slots[indiceFeed * 2];
    const equipoVisitante = slots[indiceFeed * 2 + 1];
    const partidoR1 = partidosPorRonda[1][indiceFeed];

    if (totalRondas === 1) continue;

    if (partidoR1) {
      const indiceDestinoR2 = Math.floor(indiceFeed / 2);
      const partidoDestino = partidosPorRonda[2][indiceDestinoR2];

      progresiones.push(
        await ProgresionFixtureModel.create(
          {
            torneo_id: fase.torneo_id,
            partido_origen_id: partidoR1.id,
            partido_destino_id: partidoDestino.id,
            condicion_avance: 'GANADOR',
            posicion_destino: posicionDestinoEnRonda(indiceFeed),
          },
          { transaction }
        )
      );
    } else if (equipoLocal || equipoVisitante) {
      const teamId = equipoLocal || equipoVisitante;
      const indiceDestinoR2 = Math.floor(indiceFeed / 2);
      const partidoDestino = partidosPorRonda[2][indiceDestinoR2];
      const esLocal = posicionDestinoEnRonda(indiceFeed) === 'LOCAL';

      await PartidoParticipantesModel.create(
        {
          partido_id: partidoDestino.id,
          team_id: teamId,
          es_local: esLocal,
        },
        { transaction }
      );
    }
  }

  for (let ronda = 2; ronda < totalRondas; ronda += 1) {
    for (let indicePartido = 0; indicePartido < partidosPorRonda[ronda].length; indicePartido += 1) {
      const partidoOrigen = partidosPorRonda[ronda][indicePartido];
      const indiceDestino = Math.floor(indicePartido / 2);
      const partidoDestino = partidosPorRonda[ronda + 1][indiceDestino];

      progresiones.push(
        await ProgresionFixtureModel.create(
          {
            torneo_id: fase.torneo_id,
            partido_origen_id: partidoOrigen.id,
            partido_destino_id: partidoDestino.id,
            condicion_avance: 'GANADOR',
            posicion_destino: posicionDestinoEnRonda(indicePartido),
          },
          { transaction }
        )
      );
    }
  }

  return {
    partidos: Object.values(partidosPorRonda).flat().filter(Boolean),
    progresiones,
  };
};

/**
 * Genera fixture Grupos + Eliminatorias: fase de grupos (round-robin por grupo) + fase 2 vacía.
 */
export const generarGruposEliminatorias = async (
  faseTorneoId,
  torneoConfig,
  deps = getDefaultDeps(),
  { confirmarBye = false } = {}
) => {
  const {
    TorneoInscripcion: TorneoInscripcionModel,
    GrupoEquipos: GrupoEquiposModel,
    GrupoDivision: GrupoDivisionModel,
    Partidos: PartidosModel,
    FaseTorneo: FaseTorneoModel,
    Torneos: TorneosModel,
    sequelize: sequelizeInstance,
    mezclarEquiposSorteo: mezclarCustom,
  } = deps;

  const fase = await FaseTorneoModel.findByPk(faseTorneoId, {
    include: [
      {
        model: TorneosModel,
        as: 'torneo',
        attributes: ['id', 'sport_id', 'nivel_arbitraje_default'],
      },
    ],
  });

  if (!fase) {
    return { error: 'Fase no encontrada' };
  }

  const partidosEliminatoriaEnFase = await PartidosModel.count({
    where: { fase_torneo_id: faseTorneoId, grupo_division_id: null },
  });

  if (partidosEliminatoriaEnFase > 0) {
    return { error: 'Ya existe fixture generado para esta fase' };
  }

  const numeroGrupos = torneoConfig.numero_grupos;
  const clasificadosPorGrupo = torneoConfig.clasificados_por_grupo;
  const metodo = torneoConfig.metodo_distribucion;

  const teamIds = await obtenerEquiposAceptados(fase.torneo_id, TorneoInscripcionModel);
  if (teamIds.length < numeroGrupos) {
    return {
      error: `Se necesitan al menos ${numeroGrupos} equipos inscritos para ${numeroGrupos} grupos`,
    };
  }

  const totalClasificados = numeroGrupos * clasificadosPorGrupo;
  const tamanoBracket = calcularTamanoBracket(totalClasificados);
  const necesitaBye = tamanoBracket > totalClasificados;

  if (necesitaBye && !confirmarBye) {
    return {
      requiere_confirmacion: true,
      advertencia:
        `Con ${numeroGrupos} grupos y ${clasificadosPorGrupo} clasificados (${totalClasificados} equipos), `
        + 'algunos equipos necesitarán un bye — ¿continuar?',
      totalClasificados,
      tamanoBracket,
    };
  }

  let grupos = await GrupoDivisionModel.findAll({
    where: { fase_torneo_id: faseTorneoId },
    order: [['id', 'ASC']],
  });

  await sequelizeInstance.transaction(async (transaction) => {
    if (grupos.length === 0) {
      grupos = [];
      for (let i = 0; i < numeroGrupos; i += 1) {
        const grupo = await GrupoDivisionModel.create(
          {
            fase_torneo_id: faseTorneoId,
            nombre: nombreGrupoPorIndice(i),
          },
          { transaction }
        );
        grupos.push(grupo);
      }
    } else if (grupos.length !== numeroGrupos) {
      throw new Error(
        `El número de grupos creados (${grupos.length}) no coincide con numero_grupos (${numeroGrupos})`
      );
    }

    const asignacionesExistentes = await GrupoEquiposModel.findAll({
      where: { grupo_division_id: grupos.map((g) => g.id) },
      attributes: ['grupo_division_id', 'team_id'],
      transaction,
    });

    if (metodo === 'MANUAL') {
      const equiposAsignados = new Set(asignacionesExistentes.map((a) => a.team_id));
      const faltantes = teamIds.filter((id) => !equiposAsignados.has(id));
      if (faltantes.length) {
        throw new Error(
          `Distribución MANUAL incompleta: faltan equipos por asignar (${faltantes.join(', ')})`
        );
      }
    } else if (asignacionesExistentes.length === 0) {
      const mezclar = mezclarCustom ?? mezclarEquiposSorteo;
      const sorteo = mezclar([...teamIds]);
      const repartidos = repartirEquiposEnGrupos(sorteo.equipos, numeroGrupos);

      for (let i = 0; i < grupos.length; i += 1) {
        for (const teamId of repartidos[i]) {
          await GrupoEquiposModel.create(
            {
              grupo_division_id: grupos[i].id,
              team_id: teamId,
            },
            { transaction }
          );
        }
      }
    }
  });

  const todosPartidos = [];
  const todosPartidosModelos = [];

  for (const grupo of grupos) {
    const countGrupo = await PartidosModel.count({
      where: { fase_torneo_id: faseTorneoId, grupo_division_id: grupo.id },
    });

    if (countGrupo > 0) continue;

    const rr = await generarRoundRobin(faseTorneoId, grupo.id, deps, { omitirProgramacion: true });
    if (rr.error) {
      return { error: rr.error };
    }
    todosPartidos.push(...rr.partidos);
    todosPartidosModelos.push(...(rr.partidosModelos ?? []));
  }

  const torneoCompleto = await TorneosModel.findByPk(fase.torneo_id);
  let programacion = { asignaciones: null, error: null };
  if (todosPartidosModelos.length > 0) {
    programacion = await aplicarProgramacionPartidos(
      todosPartidosModelos,
      torneoCompleto ?? fase.torneo,
      deps
    );
  }

  let faseEliminatoria = await FaseTorneoModel.findOne({
    where: {
      torneo_id: fase.torneo_id,
      tipo_formato: 'ELIMINACION_DIRECTA',
      orden: { [Op.gt]: fase.orden ?? 1 },
    },
  });

  if (!faseEliminatoria) {
    faseEliminatoria = await FaseTorneoModel.create({
      torneo_id: fase.torneo_id,
      orden: (fase.orden ?? 1) + 1,
      tipo_formato: 'ELIMINACION_DIRECTA',
      nombre: 'Eliminatorias',
    });
  }

  return {
    partidos: todosPartidos,
    grupos: grupos.map((g) => (typeof g.toJSON === 'function' ? g.toJSON() : g)),
    fase_eliminatoria_id: faseEliminatoria.id,
    totalClasificados,
    tamanoBracket,
    byes: tamanoBracket - totalClasificados,
    programacion: programacion.asignaciones ?? null,
    programacion_error: programacion.error ?? null,
  };
};

/**
 * Tras completar fase de grupos, genera bracket de eliminatorias con cruces entre grupos.
 */
export const generarEliminatoriasDesdeGrupos = async (
  torneoId,
  deps = getDefaultDeps()
) => {
  const {
    FaseTorneo: FaseTorneoModel,
    Partidos: PartidosModel,
    GrupoDivision: GrupoDivisionModel,
    Torneos: TorneosModel,
    sequelize: sequelizeInstance,
  } = deps;

  const torneo = await TorneosModel.findByPk(torneoId);
  if (!torneo) return { error: 'Torneo no encontrado' };

  const faseGrupos = await FaseTorneoModel.findOne({
    where: { torneo_id: torneoId, tipo_formato: 'GRUPOS_ELIMINATORIAS' },
    order: [['orden', 'ASC']],
  });

  if (!faseGrupos) return { error: 'No hay fase de grupos en este torneo' };

  const faseEliminatoria = await FaseTorneoModel.findOne({
    where: { torneo_id: torneoId, tipo_formato: 'ELIMINACION_DIRECTA' },
    order: [['orden', 'DESC']],
  });

  if (!faseEliminatoria) return { error: 'No hay fase de eliminatorias configurada' };

  const partidosEliminatoria = await PartidosModel.count({
    where: { fase_torneo_id: faseEliminatoria.id },
  });

  if (partidosEliminatoria > 0) {
    return { error: 'Ya existe fixture de eliminatorias' };
  }

  const partidosGruposPendientes = await PartidosModel.count({
    where: {
      fase_torneo_id: faseGrupos.id,
      state: { [Op.ne]: 'FINALIZADO' },
    },
  });

  if (partidosGruposPendientes > 0) {
    return { error: 'Aún hay partidos de fase de grupos sin finalizar', pendientes: partidosGruposPendientes };
  }

  const grupos = await GrupoDivisionModel.findAll({
    where: { fase_torneo_id: faseGrupos.id },
    order: [['id', 'ASC']],
  });

  const clasificadosPorGrupo = torneo.clasificados_por_grupo ?? 1;
  const gruposConClasificados = [];

  for (const grupo of grupos) {
    const posiciones = await calcularPosicionesTorneo(torneoId, grupo.id);
    gruposConClasificados.push({
      grupoId: grupo.id,
      nombre: grupo.nombre,
      clasificados: extraerClasificadosDePosiciones(posiciones, clasificadosPorGrupo),
    });
  }

  const { slots, byes, tamanoBracket, modoCruce } = construirSlotsEliminatoriasDesdeGrupos(
    gruposConClasificados,
    clasificadosPorGrupo
  );

  const resultado = await sequelizeInstance.transaction(async (transaction) => {
    const bracket = await crearBracketEliminacionConSlots(
      { torneo_id: torneoId, ...faseEliminatoria.toJSON() },
      faseEliminatoria.id,
      torneo,
      slots,
      deps,
      transaction
    );

    const programacion = await aplicarProgramacionPartidos(
      bracket.partidos,
      torneo,
      deps,
      transaction
    );

    if (programacion.error) {
      throw new Error(programacion.error);
    }

    return {
      partidos: bracket.partidos.map(serializarPartido),
      progresiones: bracket.progresiones.map(serializarPartido),
      tamanoBracket,
      byes,
      modoCruce,
      programacion: programacion.asignaciones,
    };
  });

  return resultado;
};

export const verificarYGenerarEliminatoriasTrasGrupos = async (torneoId, deps = getDefaultDeps()) => {
  try {
    return await generarEliminatoriasDesdeGrupos(torneoId, deps);
  } catch (error) {
    return { error: error.message };
  }
};
