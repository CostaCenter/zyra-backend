import { Op, QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import {
  Team,
  TeamMiembros,
  Torneos,
  FaseTorneo,
  Sports,
  Partidos,
  PartidoParticipantes,
  TorneoInscripcion,
  TorneoPlantilla,
  User,
  UsuarioStatsPorSport,
} from '../db/db.js';
import { calcularPosicionesTorneo } from './calcularPosicionesTorneo.js';
import { resolverFaseActiva } from './torneoPerfilService.js';

const MANOS_HABIL_VALIDAS = ['DERECHA', 'IZQUIERDA', 'AMBIDIESTRO'];

const POSICIONES_VOLEY = ['ARMADOR', 'CENTRAL', 'PUNTA', 'OPUESTO', 'LÍBERO', 'LIBERO'];
const POSICIONES_FUTBOL = ['PORTERO', 'DEFENSA', 'MEDIOCAMPISTA', 'DELANTERO'];

const ESTADOS_PENDIENTES = new Set(['PROGRAMADO', 'pendiente']);

const parseDorsal = (value) => {
  if (value == null || value === '') return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0 || n > 99) return NaN;
  return n;
};

const parseManoHabil = (value) => {
  if (value == null || value === '') return null;
  const normalizado = String(value).toUpperCase();
  return MANOS_HABIL_VALIDAS.includes(normalizado) ? normalizado : undefined;
};

const posicionesValidasParaDeporte = (sportName = '') => {
  const normalized = String(sportName).toLowerCase();
  if (normalized.includes('vole')) return POSICIONES_VOLEY;
  if (normalized.includes('futbol') || normalized.includes('fútbol')) return POSICIONES_FUTBOL;
  return null;
};

const parsePosicion = (value, sportName) => {
  if (value == null || value === '') return null;
  const normalizado = String(value).trim().toUpperCase();
  const validas = posicionesValidasParaDeporte(sportName);
  if (validas && !validas.includes(normalizado)) return undefined;
  return normalizado;
};

const serializarJugadorPlantilla = (miembro, plantillaRow, statsDeporte, golesTorneo = 0) => {
  const plantilla = plantillaRow ?? {};
  return {
    id: miembro.id,
    user_id: miembro.user_id,
    rol: miembro.rol,
    position: miembro.position,
    dorsal_habitual: miembro.dorsal_habitual,
    dorsal_torneo: plantilla.dorsal_torneo ?? null,
    posicion_torneo: plantilla.posicion_torneo ?? null,
    mano_habil_torneo: plantilla.mano_habil_torneo ?? null,
    es_libero: Boolean(plantilla.es_libero),
    goles_torneo: golesTorneo,
    posicion_referencia: miembro.position ?? statsDeporte?.posicion_principal ?? null,
    mano_habil_referencia: statsDeporte?.mano_habil ?? statsDeporte?.pierna_habil ?? null,
    usuario: miembro.usuario
      ? {
          id: miembro.usuario.id,
          nick: miembro.usuario.nick,
          name: miembro.usuario.name,
          photo: miembro.usuario.photo,
        }
      : null,
  };
};

const assertInscripcionAceptada = async (torneoId, teamId) => {
  const inscripcion = await TorneoInscripcion.findOne({
    where: {
      torneo_id: torneoId,
      team_id: teamId,
      estado: 'ACEPTADA',
    },
  });

  if (!inscripcion) {
    return { error: { status: 404, message: 'El equipo no está inscrito en este torneo' } };
  }

  return { inscripcion };
};

const ordenarPosiciones = (filas = []) =>
  [...filas].sort((a, b) => {
    if ((b.puntos ?? 0) !== (a.puntos ?? 0)) return (b.puntos ?? 0) - (a.puntos ?? 0);
    if ((b.diferencia_sets ?? 0) !== (a.diferencia_sets ?? 0)) {
      return (b.diferencia_sets ?? 0) - (a.diferencia_sets ?? 0);
    }
    return String(a.team_nombre ?? '').localeCompare(String(b.team_nombre ?? ''));
  });

const obtenerEstadisticasEquipoTorneo = async (torneoId, teamId) => {
  const torneo = await Torneos.findByPk(torneoId, {
    attributes: ['id', 'nombre', 'sport_id'],
    include: [
      {
        model: FaseTorneo,
        as: 'fases',
        attributes: ['id', 'orden', 'nombre', 'tipo_formato'],
      },
      {
        model: Sports,
        as: 'sport',
        attributes: ['id', 'name'],
      },
    ],
  });

  if (!torneo) {
    return {
      partidos_jugados: 0,
      ganados: 0,
      perdidos: 0,
      posicion_tabla: null,
      total_equipos: null,
      formato_todos_contra_todos: false,
      proximo_partido: null,
    };
  }

  const [posicionesRaw, partidosRaw] = await Promise.all([
    calcularPosicionesTorneo(torneoId),
    Partidos.findAll({
      where: {
        torneo_id: torneoId,
        state: { [Op.in]: ['PROGRAMADO', 'pendiente'] },
      },
      include: [{
        model: PartidoParticipantes,
        as: 'participantes',
        attributes: ['team_id', 'es_local'],
        include: [{
          model: Team,
          as: 'equipo',
          attributes: ['id', 'name', 'logo_url'],
        }],
      }],
      order: [['datetime', 'ASC'], ['id', 'ASC']],
    }),
  ]);

  const posiciones = ordenarPosiciones(posicionesRaw);
  const idx = posiciones.findIndex((fila) => Number(fila.team_id) === Number(teamId));
  const fila = idx >= 0
    ? posiciones[idx]
    : { partidos_jugados: 0, ganados: 0, perdidos: 0 };

  const faseActiva = resolverFaseActiva(torneo.fases ?? [], partidosRaw);
  const esRoundRobin = faseActiva?.tipo_formato === 'TODOS_CONTRA_TODOS';

  let proximoPartido = null;
  for (const partido of partidosRaw) {
    const participantes = partido.participantes ?? [];
    const propio = participantes.find((p) => Number(p.team_id) === Number(teamId));
    if (!propio || !ESTADOS_PENDIENTES.has(partido.state)) continue;

    const rivalParticipante = participantes.find((p) => Number(p.team_id) !== Number(teamId));
    const rivalEquipo = rivalParticipante?.equipo;

    proximoPartido = {
      id: partido.id,
      datetime: partido.datetime ?? null,
      jornada: partido.jornada ?? null,
      es_local: Boolean(propio.es_local),
      rival: rivalEquipo
        ? {
            id: rivalEquipo.id,
            name: rivalEquipo.name,
            logo_url: rivalEquipo.logo_url ?? null,
          }
        : rivalParticipante?.team_id
          ? { id: rivalParticipante.team_id, name: null, logo_url: null }
          : null,
    };
    break;
  }

  return {
    partidos_jugados: Number(fila.partidos_jugados ?? 0),
    ganados: Number(fila.ganados ?? 0),
    perdidos: Number(fila.perdidos ?? 0),
    puntos: Number(fila.puntos ?? 0),
    posicion_tabla: esRoundRobin && idx >= 0 ? idx + 1 : null,
    total_equipos: esRoundRobin ? posiciones.length : null,
    formato_todos_contra_todos: esRoundRobin,
    proximo_partido: proximoPartido,
  };
};

/**
 * Plantel y estadísticas del equipo dentro de un torneo.
 */
export const obtenerPlantillaTorneo = async (torneoId, teamId, viewerId) => {
  const auth = await assertInscripcionAceptada(torneoId, teamId);
  if (auth.error) return auth;

  const torneo = await Torneos.findByPk(torneoId, {
    attributes: ['id', 'nombre', 'sport_id', 'photo', 'imagen_portada_url', 'estado'],
    include: [{
      model: Sports,
      as: 'sport',
      attributes: ['id', 'name'],
    }],
  });

  if (!torneo) {
    return { error: { status: 404, message: 'Torneo no encontrado' } };
  }

  const equipo = await Team.findByPk(teamId, {
    attributes: ['id', 'name', 'logo_url', 'capitan_id'],
  });
  if (!equipo) {
    return { error: { status: 404, message: 'Equipo no encontrado' } };
  }

  const [miembros, plantillaRows, estadisticas, golesRows] = await Promise.all([
    TeamMiembros.findAll({
      where: { team_id: teamId, estado_invitacion: 'ACEPTADO' },
      include: [{
        model: User,
        as: 'usuario',
        attributes: ['id', 'nick', 'name', 'photo'],
      }],
      order: [['rol', 'ASC'], ['id', 'ASC']],
    }),
    TorneoPlantilla.findAll({
      where: { torneo_id: torneoId, team_id: teamId },
    }),
    obtenerEstadisticasEquipoTorneo(torneoId, teamId),
    sequelize.query(
      `
      SELECT
        pjs.user_id,
        COALESCE(SUM(pjs.goles), 0)::int AS goles_torneo
      FROM partido_jugador_stats pjs
      INNER JOIN partidos p ON p.id = pjs.partido_id
      WHERE p.torneo_id = :torneoId
        AND pjs.team_id = :teamId
        AND p.state = 'FINALIZADO'
      GROUP BY pjs.user_id
      `,
      {
        replacements: { torneoId, teamId },
        type: QueryTypes.SELECT,
      }
    ),
  ]);

  const userIds = miembros.map((m) => m.user_id).filter(Boolean);
  const statsRows = userIds.length && torneo.sport_id
    ? await UsuarioStatsPorSport.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          sport_id: torneo.sport_id,
        },
        attributes: ['user_id', 'posicion_principal', 'mano_habil', 'pierna_habil'],
      })
    : [];

  const plantillaPorUser = new Map(
    plantillaRows.map((row) => [row.user_id, row])
  );
  const statsPorUser = new Map(
    statsRows.map((row) => [row.user_id, row])
  );
  const golesPorUser = new Map(
    golesRows.map((row) => [row.user_id, Number(row.goles_torneo ?? 0)])
  );

  const jugadores = miembros
    .map((miembro) =>
      serializarJugadorPlantilla(
        miembro,
        plantillaPorUser.get(miembro.user_id),
        statsPorUser.get(miembro.user_id),
        golesPorUser.get(miembro.user_id) ?? 0
      ))
    .sort((a, b) => {
      if (a.rol === 'CAPITAN' && b.rol !== 'CAPITAN') return -1;
      if (b.rol === 'CAPITAN' && a.rol !== 'CAPITAN') return 1;
      return (a.usuario?.name || '').localeCompare(b.usuario?.name || '');
    });

  const esCapitan = Number(viewerId) === Number(equipo.capitan_id);
  const sportName = torneo.sport?.name ?? '';

  return {
    data: {
      torneo_id: torneoId,
      torneo: {
        id: torneo.id,
        nombre: torneo.nombre,
        sport_id: torneo.sport_id,
        photo: torneo.photo ?? null,
        imagen_portada_url: torneo.imagen_portada_url ?? torneo.photo ?? null,
        estado: torneo.estado ?? null,
        sport: torneo.sport ? { id: torneo.sport.id, name: torneo.sport.name } : null,
      },
      equipo: {
        id: equipo.id,
        name: equipo.name,
        logo_url: equipo.logo_url,
        capitan_id: equipo.capitan_id,
      },
      jugadores,
      opciones: {
        posiciones: posicionesValidasParaDeporte(sportName),
        manos_habil: MANOS_HABIL_VALIDAS,
      },
      estadisticas,
      social: {
        es_capitan: esCapitan,
        puede_editar: esCapitan,
      },
    },
  };
};

/**
 * Guarda configuración de plantilla del torneo. Solo capitán del equipo inscrito.
 */
export const actualizarPlantillaTorneo = async (torneoId, teamId, viewerId, plantillaInput) => {
  const auth = await assertInscripcionAceptada(torneoId, teamId);
  if (auth.error) return auth;

  const torneo = await Torneos.findByPk(torneoId, {
    attributes: ['id', 'sport_id'],
    include: [{
      model: Sports,
      as: 'sport',
      attributes: ['name'],
    }],
  });
  if (!torneo) {
    return { error: { status: 404, message: 'Torneo no encontrado' } };
  }

  const equipo = await Team.findByPk(teamId, {
    attributes: ['id', 'capitan_id'],
  });
  if (!equipo) {
    return { error: { status: 404, message: 'Equipo no encontrado' } };
  }

  if (Number(equipo.capitan_id) !== Number(viewerId)) {
    return {
      error: {
        status: 403,
        message: 'Solo el capitán puede configurar la plantilla del torneo',
      },
    };
  }

  if (!Array.isArray(plantillaInput)) {
    return { error: { status: 400, message: 'plantilla debe ser un arreglo' } };
  }

  const miembros = await TeamMiembros.findAll({
    where: { team_id: teamId, estado_invitacion: 'ACEPTADO' },
    attributes: ['user_id'],
  });
  const miembrosIds = new Set(miembros.map((m) => m.user_id));
  const sportName = torneo.sport?.name ?? '';

  const parsed = [];
  const seenUsers = new Set();
  const seenDorsales = new Set();

  for (const item of plantillaInput) {
    const userId = Number.parseInt(item?.user_id, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      return { error: { status: 400, message: 'Cada entrada debe incluir user_id válido' } };
    }
    if (!miembrosIds.has(userId)) {
      return { error: { status: 400, message: 'Hay jugadores que no pertenecen al equipo' } };
    }
    if (seenUsers.has(userId)) {
      return { error: { status: 400, message: 'Hay jugadores duplicados en la solicitud' } };
    }
    seenUsers.add(userId);

    const dorsal = parseDorsal(item?.dorsal_torneo);
    if (Number.isNaN(dorsal)) {
      return { error: { status: 400, message: 'Los dorsales deben ser números entre 0 y 99' } };
    }
    if (dorsal != null) {
      if (seenDorsales.has(dorsal)) {
        return {
          error: { status: 400, message: 'No puede haber dorsales duplicados en el torneo' },
        };
      }
      seenDorsales.add(dorsal);
    }

    const posicion = parsePosicion(item?.posicion_torneo, sportName);
    if (posicion === undefined) {
      return { error: { status: 400, message: 'Hay posiciones inválidas para este deporte' } };
    }

    const mano = parseManoHabil(item?.mano_habil_torneo);
    if (mano === undefined) {
      return {
        error: { status: 400, message: "mano_habil_torneo debe ser 'DERECHA', 'IZQUIERDA' o 'AMBIDIESTRO'" },
      };
    }

    parsed.push({
      user_id: userId,
      dorsal_torneo: dorsal,
      posicion_torneo: posicion,
      mano_habil_torneo: mano,
      es_libero: Boolean(item?.es_libero),
    });
  }

  const transaction = await sequelize.transaction();
  try {
    for (const entry of parsed) {
      const vacia = (
        entry.dorsal_torneo == null
        && entry.posicion_torneo == null
        && entry.mano_habil_torneo == null
        && !entry.es_libero
      );

      if (vacia) {
        await TorneoPlantilla.destroy({
          where: {
            torneo_id: torneoId,
            team_id: teamId,
            user_id: entry.user_id,
          },
          transaction,
        });
        continue;
      }

      const [row, created] = await TorneoPlantilla.findOrCreate({
        where: {
          torneo_id: torneoId,
          team_id: teamId,
          user_id: entry.user_id,
        },
        defaults: {
          dorsal_torneo: entry.dorsal_torneo,
          posicion_torneo: entry.posicion_torneo,
          mano_habil_torneo: entry.mano_habil_torneo,
          es_libero: entry.es_libero,
        },
        transaction,
      });

      if (!created) {
        await row.update(
          {
            dorsal_torneo: entry.dorsal_torneo,
            posicion_torneo: entry.posicion_torneo,
            mano_habil_torneo: entry.mano_habil_torneo,
            es_libero: entry.es_libero,
            actualizado_at: new Date(),
          },
          { transaction }
        );
      }
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return {
        error: { status: 409, message: 'Ese dorsal ya está asignado a otro jugador en este torneo' },
      };
    }
    throw error;
  }

  return obtenerPlantillaTorneo(torneoId, teamId, viewerId);
};

/** @deprecated usar actualizarPlantillaTorneo */
export const actualizarDorsalesTorneo = actualizarPlantillaTorneo;

/**
 * Mapa user_id -> dorsal_torneo para enriquecer plantel en otros flujos.
 */
export const mapaDorsalesTorneo = async (torneoId, teamId) => {
  const rows = await TorneoPlantilla.findAll({
    where: {
      torneo_id: torneoId,
      team_id: teamId,
      dorsal_torneo: { [Op.ne]: null },
    },
    attributes: ['user_id', 'dorsal_torneo'],
  });
  return new Map(rows.map((row) => [row.user_id, row.dorsal_torneo]));
};
