import {
  Torneos,
  FaseTorneo,
  GrupoDivision,
  GrupoEquipos,
  Sports,
  Complejos,
  TorneoInscripcion,
  Partidos,
  PartidoParticipantes,
  Team,
  User,
  ProgresionFixture,
} from '../db/db.js';
import { Op } from 'sequelize';
import { obtenerConfigLogistica } from './torneoConfigService.js';

const ESTADOS_JUGADOS = new Set(['FINALIZADO', 'WALKOVER']);

const includeTorneoPerfil = [
  { model: Sports, as: 'sport', attributes: ['id', 'name'] },
  { model: Complejos, as: 'complejo', attributes: ['id', 'nombre', 'ubicacion'] },
  {
    model: FaseTorneo,
    as: 'fases',
    include: [{
      model: GrupoDivision,
      as: 'grupos',
      include: [{
        model: GrupoEquipos,
        as: 'equipos',
        include: [{
          model: Team,
          as: 'equipo',
          attributes: ['id', 'name', 'logo_url'],
        }],
      }],
    }],
  },
];

const serializarEquipo = (equipo) =>
  equipo
    ? {
        id: equipo.id,
        name: equipo.name,
        logo_url: equipo.logo_url ?? null,
      }
    : null;

const enriquecerOrdenSorteo = (ordenSorteo, equipos = []) => {
  const base = ordenSorteo && typeof ordenSorteo === 'object' ? ordenSorteo : { sorteos: [] };
  if (!base.sorteos?.length) return { sorteos: [] };

  const equiposPorId = new Map(equipos.map((equipo) => [equipo.id, equipo]));

  return {
    sorteos: base.sorteos.map((sorteo) => ({
      ...sorteo,
      equipos_sorteo: (sorteo.team_ids_sorteo ?? []).map((teamId) => {
        const equipo = equiposPorId.get(teamId);
        return equipo ?? { id: teamId, name: null, logo_url: null };
      }),
    })),
  };
};

export const serializarPartidoPublico = (partido) => {
  const json = typeof partido.toJSON === 'function' ? partido.toJSON() : partido;
  const participantes = json.participantes ?? [];
  const local = participantes.find((p) => p.es_local === true);
  const visitante = participantes.find((p) => p.es_local === false);
  const jugado = ESTADOS_JUGADOS.has(json.state);
  const grupoDivision = json.grupoDivision ?? json.grupo ?? null;
  const canchaId = json.cancha_id ?? null;

  return {
    id: json.id,
    torneo_id: json.torneo_id,
    fase_torneo_id: json.fase_torneo_id,
    grupo_division_id: json.grupo_division_id ?? null,
    grupo: grupoDivision
      ? { id: grupoDivision.id, nombre: grupoDivision.nombre }
      : null,
    jornada: json.jornada ?? null,
    state: json.state,
    datetime: json.datetime ?? null,
    fecha_hora_programada: json.datetime ?? null,
    cancha_id: canchaId,
    cancha_asignada: canchaId != null
      ? { numero: canchaId, nombre: `Cancha ${canchaId}` }
      : null,
    score_local_final: jugado ? json.score_local_final ?? 0 : null,
    score_visitante_final: jugado ? json.score_visitante_final ?? 0 : null,
    equipo_local: serializarEquipo(local?.equipo) ?? (local?.team_id
      ? { id: local.team_id, name: null, logo_url: null }
      : null),
    equipo_visitante: serializarEquipo(visitante?.equipo) ?? (visitante?.team_id
      ? { id: visitante.team_id, name: null, logo_url: null }
      : null),
    arbitro: json.arbitro
      ? { id: json.arbitro.id, nick: json.arbitro.nick, name: json.arbitro.name }
      : null,
  };
};

export const resolverFaseActiva = (fases = [], partidos = []) => {
  if (!fases.length) return null;

  const ordenadas = [...fases].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  for (const fase of ordenadas) {
    const deFase = partidos.filter((p) => p.fase_torneo_id === fase.id);
    if (!deFase.length) continue;
    const hayPendiente = deFase.some((p) => !ESTADOS_JUGADOS.has(p.state));
    if (hayPendiente) return fase;
  }

  const conPartidos = [...ordenadas].reverse().find((fase) =>
    partidos.some((p) => p.fase_torneo_id === fase.id)
  );

  return conPartidos ?? ordenadas[0];
};

const nombreRonda = (ronda, total) => {
  const desdeFinal = total - ronda;
  if (desdeFinal === 0) return 'Final';
  if (desdeFinal === 1) return 'Semifinales';
  if (desdeFinal === 2) return 'Cuartos';
  if (desdeFinal === 3) return 'Octavos';
  return `Ronda ${ronda}`;
};

export const armarBracket = (partidos = [], progresiones = []) => {
  if (!partidos.length) return { rondas: [] };

  const destinos = new Set(progresiones.map((p) => p.partido_destino_id));
  const rondaById = {};

  partidos.forEach((partido) => {
    if (!destinos.has(partido.id)) {
      rondaById[partido.id] = 1;
    }
  });

  let cambio = true;
  while (cambio) {
    cambio = false;
    progresiones.forEach((prog) => {
      const origen = rondaById[prog.partido_origen_id];
      if (origen && !rondaById[prog.partido_destino_id]) {
        rondaById[prog.partido_destino_id] = origen + 1;
        cambio = true;
      }
    });
  }

  partidos.forEach((partido) => {
    if (!rondaById[partido.id]) rondaById[partido.id] = 1;
  });

  const maxRonda = Math.max(1, ...Object.values(rondaById));
  const rondas = [];

  for (let ronda = 1; ronda <= maxRonda; ronda += 1) {
    rondas.push({
      ronda,
      nombre: nombreRonda(ronda, maxRonda),
      partidos: partidos.filter((partido) => rondaById[partido.id] === ronda),
    });
  }

  return { rondas };
};

export const obtenerPerfilPublicoTorneo = async (torneoId, viewerId) => {
  const torneo = await Torneos.findByPk(torneoId, {
    include: includeTorneoPerfil,
    order: [[{ model: FaseTorneo, as: 'fases' }, 'orden', 'ASC']],
  });

  if (!torneo) return null;

  const [inscripciones, partidosRaw, progresionesRaw] = await Promise.all([
    TorneoInscripcion.findAll({
      where: { torneo_id: torneoId, estado: 'ACEPTADA' },
      include: [{
        model: Team,
        as: 'equipo',
        attributes: ['id', 'name', 'logo_url'],
      }],
      order: [['id', 'ASC']],
    }),
    Partidos.findAll({
      where: { torneo_id: torneoId },
      include: [
        {
          model: User,
          as: 'arbitro',
          attributes: ['id', 'nick', 'name'],
          required: false,
        },
        {
          model: PartidoParticipantes,
          as: 'participantes',
          attributes: ['team_id', 'es_local'],
          include: [{
            model: Team,
            as: 'equipo',
            attributes: ['id', 'name', 'logo_url'],
          }],
        },
        {
          model: GrupoDivision,
          as: 'grupoDivision',
          attributes: ['id', 'nombre'],
          required: false,
        },
      ],
      order: [['id', 'ASC']],
    }),
    ProgresionFixture.findAll({
      where: { torneo_id: torneoId },
      attributes: ['partido_origen_id', 'partido_destino_id', 'posicion_destino'],
    }),
  ]);

  const partidos = partidosRaw.map(serializarPartidoPublico);
  const equipos = inscripciones
    .map((inscripcion) => serializarEquipo(inscripcion.equipo))
    .filter(Boolean);

  const fases = (torneo.fases ?? []).map((fase) => ({
    id: fase.id,
    orden: fase.orden,
    nombre: fase.nombre,
    tipo_formato: fase.tipo_formato,
  }));

  const faseActivaModelo = resolverFaseActiva(torneo.fases ?? [], partidosRaw);
  const faseActiva = faseActivaModelo
    ? {
        id: faseActivaModelo.id,
        orden: faseActivaModelo.orden,
        nombre: faseActivaModelo.nombre,
        tipo_formato: faseActivaModelo.tipo_formato,
      }
    : null;

  const partidosFase = faseActiva
    ? partidos.filter((p) => p.fase_torneo_id === faseActiva.id)
    : partidos;

  const progresiones = progresionesRaw.map((row) =>
    typeof row.toJSON === 'function' ? row.toJSON() : row
  );

  const esEliminacion = faseActiva?.tipo_formato === 'ELIMINACION_DIRECTA';
  const bracket = esEliminacion
    ? armarBracket(partidosFase, progresiones)
    : null;

  const esOrganizador = Number(viewerId) === Number(torneo.creado_por_user_id);
  const solicitudesPendientes = esOrganizador
    ? await TorneoInscripcion.count({
        where: {
          torneo_id: torneoId,
          estado: 'PENDIENTE',
          origen: 'SOLICITUD_EQUIPO',
        },
      })
    : 0;

  let misInscripciones = [];
  if (viewerId && torneo.sport_id) {
    const equiposCapitan = await Team.findAll({
      where: { capitan_id: viewerId, sport_id: torneo.sport_id },
      attributes: ['id', 'name'],
    });
    const teamIds = equiposCapitan.map((equipo) => equipo.id);
    if (teamIds.length > 0) {
      const propias = await TorneoInscripcion.findAll({
        where: {
          torneo_id: torneoId,
          team_id: { [Op.in]: teamIds },
        },
        include: [{
          model: Team,
          as: 'equipo',
          attributes: ['id', 'name', 'logo_url'],
        }],
        order: [['creado_at', 'DESC']],
      });
      misInscripciones = propias.map((row) => row.toJSON());
    }
  }

  const partidosJugados = partidos.filter((p) => ESTADOS_JUGADOS.has(p.state)).length;
  const tipoFormato = fases.length === 1 ? fases[0].tipo_formato : faseActiva?.tipo_formato ?? null;
  const configLogistica = obtenerConfigLogistica(torneo);
  const nombreFase =
    faseActiva?.nombre
    || (faseActiva?.tipo_formato === 'ELIMINACION_DIRECTA'
      ? 'Eliminación directa'
      : faseActiva?.tipo_formato === 'GRUPOS_ELIMINATORIAS'
        ? 'Grupos + Eliminatorias'
      : faseActiva?.tipo_formato === 'TODOS_CONTRA_TODOS'
        ? 'Todos contra todos'
        : null);

  return {
    torneo: {
      id: torneo.id,
      nombre: torneo.nombre,
      photo: torneo.photo ?? null,
      imagen_portada_url: torneo.imagen_portada_url ?? torneo.photo ?? null,
      fecha_hora_inicio: torneo.fecha_hora_inicio ?? null,
      lugar: torneo.lugar ?? null,
      costo_inscripcion: torneo.costo_inscripcion ?? null,
      premiacion: torneo.premiacion ?? null,
      estado: torneo.estado,
      visibilidad: torneo.visibilidad,
      modalidad: torneo.modalidad,
      max_equipos: torneo.max_equipos,
      max_jugadores_equipo: torneo.max_jugadores_equipo ?? null,
      numero_canchas: torneo.numero_canchas ?? 1,
      tipo_duracion: torneo.tipo_duracion ?? 'RELAMPAGO',
      fecha_fin: torneo.fecha_fin ?? null,
      hora_inicio_diaria: torneo.hora_inicio_diaria ?? null,
      hora_fin_diaria: torneo.hora_fin_diaria ?? null,
      descanso_minimo_entre_partidos_minutos: configLogistica.descanso_minimo_entre_partidos_minutos,
      duracion_partido_programacion_minutos: configLogistica.duracion_partido_programacion_minutos,
      margen_seguridad_partido_minutos: configLogistica.margen_seguridad_partido_minutos,
      /** @deprecated calculado automáticamente — usar descanso_minimo_entre_partidos_minutos */
      descanso_minimo_minutos: configLogistica.descanso_minimo_entre_partidos_minutos,
      horario_actualizado_en: torneo.horario_actualizado_en ?? null,
      horario_actualizado: Boolean(torneo.horario_actualizado_en),
      horario_actualizado_resumen: torneo.horario_actualizado_resumen ?? null,
      duracion_promedio_set_minutos: torneo.duracion_promedio_set_minutos ?? 30,
      descanso_entre_sets_minutos: torneo.descanso_entre_sets_minutos ?? 5,
      numero_grupos: torneo.numero_grupos ?? null,
      clasificados_por_grupo: torneo.clasificados_por_grupo ?? null,
      metodo_distribucion: torneo.metodo_distribucion ?? null,
      requiere_partido_grupos_para_eliminatoria:
        torneo.requiere_partido_grupos_para_eliminatoria ?? false,
      reglas_arbitraje_json: esOrganizador
        ? (torneo.reglas_arbitraje_json ?? {})
        : undefined,
      sport_id: torneo.sport_id,
      sport: torneo.sport ? { id: torneo.sport.id, name: torneo.sport.name } : null,
      complejo: torneo.complejo
        ? { id: torneo.complejo.id, nombre: torneo.complejo.nombre, ubicacion: torneo.complejo.ubicacion }
        : null,
      creado_por_user_id: torneo.creado_por_user_id,
      orden_sorteo: enriquecerOrdenSorteo(torneo.orden_sorteo, equipos),
    },
    fases,
    fase_activa: faseActiva,
    tipo_formato: tipoFormato,
    resumen: {
      equipos_inscritos: equipos.length,
      max_equipos: torneo.max_equipos ?? null,
      fase_actual: nombreFase,
      partidos_jugados: partidosJugados,
    },
    equipos,
    partidos,
    bracket,
    mis_inscripciones: misInscripciones,
    social: {
      es_organizador: esOrganizador,
      solicitudes_pendientes: solicitudesPendientes,
    },
  };
};
