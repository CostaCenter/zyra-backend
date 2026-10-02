import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import {
  Team,
  User,
  TeamMiembros,
  UsuarioStatsPorSport,
  Sports,
} from '../db/db.js';
import { resolverPermisosEquipo } from './teamsService.js';
import { mapUserForClient, USER_PUBLIC_ATTRIBUTES } from '../utils/userAvatar.js';

const MANOS_HABIL_VALIDAS = ['DERECHA', 'IZQUIERDA', 'AMBIDIESTRO'];

const validarManoHabil = (valor) => {
  if (valor === null || valor === '') return null;
  const normalizado = String(valor).trim().toUpperCase();
  return MANOS_HABIL_VALIDAS.includes(normalizado) ? normalizado : undefined;
};

const parseDorsal = (value) => {
  if (value === null || value === '') return null;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0 || n > 99) return undefined;
  return n;
};

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const formatearResultado = (esLocal, scoreLocal, scoreVisitante) => {
  const local = scoreLocal ?? 0;
  const visitante = scoreVisitante ?? 0;
  if (esLocal) {
    return `${local}-${visitante}`;
  }
  return `${visitante}-${local}`;
};

const calcularGanado = (esLocal, scoreLocal, scoreVisitante) => {
  const local = scoreLocal ?? 0;
  const visitante = scoreVisitante ?? 0;
  const miScore = esLocal ? local : visitante;
  const rivalScore = esLocal ? visitante : local;
  if (miScore === rivalScore) return null;
  return miScore > rivalScore;
};

const ANULACION_NO_EXISTE = `
  AND NOT EXISTS (
    SELECT 1
    FROM eventos_partido anul
    WHERE anul.partido_id = p.id
      AND anul.tipo_evento = 'ANULACION_EVENTO'
      AND anul.detalle_json->>'evento_anulado_id' = ep.id::text
  )
`;

/**
 * Stats por partido finalizado para un jugador en un equipo.
 */
export const listarStatsPorPartidoUsuario = async (userId, teamId) => {
  const filas = await sequelize.query(
    `
    SELECT
      p.id AS partido_id,
      p.datetime AS fecha,
      p.score_local_final,
      p.score_visitante_final,
      pp.es_local,
      rival_equipo.name AS rival_nombre,
      rival_equipo.id AS rival_team_id,
      t.id AS torneo_id,
      t.nombre AS torneo_nombre,
      COALESCE(
        (
          SELECT COUNT(*)::int
          FROM eventos_partido ep
          WHERE ep.partido_id = p.id
            AND ep.tipo_evento = 'PUNTO'
            AND (ep.detalle_json->>'jugador_id')::int = :userId
            ${ANULACION_NO_EXISTE}
        ),
        0
      ) AS goles_jugador,
      COALESCE(pjs.asistencias, 0)::int AS asistencias_jugador,
      COALESCE(
        (
          SELECT COUNT(*)::int
          FROM eventos_partido ep
          WHERE ep.partido_id = p.id
            AND ep.tipo_evento = 'SANCION'
            AND ep.actor_principal_id = :userId
            AND ep.detalle_json->>'tarjeta' = 'AMARILLA'
            ${ANULACION_NO_EXISTE}
        ),
        0
      ) AS amarillas_jugador,
      COALESCE(
        (
          SELECT COUNT(*)::int
          FROM eventos_partido ep
          WHERE ep.partido_id = p.id
            AND ep.tipo_evento = 'SANCION'
            AND ep.actor_principal_id = :userId
            AND ep.detalle_json->>'tarjeta' = 'ROJA'
            ${ANULACION_NO_EXISTE}
        ),
        0
      ) AS rojas_jugador
    FROM partidos p
    INNER JOIN "Partido_Participantes" pp
      ON pp.partido_id = p.id AND pp.team_id = :teamId
    INNER JOIN partido_nominas pn
      ON pn.partido_id = p.id
      AND pn.team_id = :teamId
      AND pn.user_id = :userId
      AND pn.estado_validacion = 'VALIDADO'
    INNER JOIN "Partido_Participantes" pp_rival
      ON pp_rival.partido_id = p.id AND pp_rival.team_id <> :teamId
    INNER JOIN "Team" rival_equipo
      ON rival_equipo.id = pp_rival.team_id
    LEFT JOIN torneos t ON t.id = p.torneo_id
    LEFT JOIN partido_jugador_stats pjs
      ON pjs.partido_id = p.id
      AND pjs.user_id = :userId
      AND pjs.team_id = :teamId
    WHERE p.state = 'FINALIZADO'
    ORDER BY p.datetime DESC NULLS LAST, p.id DESC
    `,
    {
      replacements: { userId, teamId },
      type: QueryTypes.SELECT,
    }
  );

  return filas.map((fila) => ({
    partido_id: fila.partido_id,
    fecha: fila.fecha,
    rival: {
      team_id: fila.rival_team_id,
      nombre: fila.rival_nombre,
    },
    resultado: formatearResultado(
      fila.es_local,
      fila.score_local_final,
      fila.score_visitante_final
    ),
    ganado: calcularGanado(
      fila.es_local,
      fila.score_local_final,
      fila.score_visitante_final
    ),
    torneo: fila.torneo_id
      ? { id: fila.torneo_id, nombre: fila.torneo_nombre }
      : null,
    goles: fila.goles_jugador,
    asistencias: fila.asistencias_jugador,
    amarillas: fila.amarillas_jugador,
    rojas: fila.rojas_jugador,
    puntos: fila.goles_jugador,
  }));
};

/**
 * Detalle completo equipo/jugador: metadata + partidos + totales.
 */
export const obtenerDetalleEquipoJugador = async (userId, teamId, viewerId = null) => {
  const membresia = await TeamMiembros.findOne({
    where: {
      user_id: userId,
      team_id: teamId,
      estado_invitacion: 'ACEPTADO',
    },
    include: [
      {
        model: Team,
        as: 'equipo',
        attributes: [
          'id',
          'name',
          'logo_url',
          'sport_id',
          'capitan_id',
          'club_id',
          'club_division_id',
        ],
        include: [
          {
            model: Sports,
            as: 'sport',
            attributes: ['id', 'name'],
          },
        ],
      },
      {
        model: User,
        as: 'usuario',
        attributes: USER_PUBLIC_ATTRIBUTES,
      },
    ],
  });

  if (!membresia) {
    return null;
  }

  const equipo = membresia.equipo;
  const jugador = membresia.usuario;
  const sportId = equipo?.sport_id;

  let statsDeporte = null;
  if (sportId) {
    statsDeporte = await UsuarioStatsPorSport.findOne({
      where: { user_id: userId, sport_id: sportId },
      attributes: ['pierna_habil', 'mano_habil', 'posicion_principal', 'dorsal_preferido'],
    });
  }

  const partidos = await listarStatsPorPartidoUsuario(userId, teamId);

  const totales = partidos.reduce(
    (acc, partido) => ({
      goles: acc.goles + (partido.goles ?? 0),
      asistencias: acc.asistencias + (partido.asistencias ?? 0),
      amarillas: acc.amarillas + (partido.amarillas ?? 0),
      rojas: acc.rojas + (partido.rojas ?? 0),
    }),
    { goles: 0, asistencias: 0, amarillas: 0, rojas: 0 }
  );

  let permisos = { puede_editar_datos: false };
  if (viewerId != null) {
    const permisosEquipo = await resolverPermisosEquipo(equipo, viewerId);
    permisos = {
      puede_editar_datos: permisosEquipo.puede_gestionar_plantilla,
    };
  }

  return {
    equipo: {
      id: equipo.id,
      name: equipo.name,
      logo_url: equipo.logo_url,
      sport: equipo.sport
        ? { id: equipo.sport.id, name: equipo.sport.name }
        : null,
    },
    jugador: {
      ...mapUserForClient(jugador),
      dorsal: membresia.dorsal_habitual ?? statsDeporte?.dorsal_preferido ?? null,
      position: membresia.position ?? statsDeporte?.posicion_principal ?? null,
      pierna_habil: statsDeporte?.pierna_habil ?? null,
      mano_habil: statsDeporte?.mano_habil ?? null,
    },
    permisos,
    totales,
    partidos,
  };
};

/** Actualiza dorsal/posición del miembro y mano/pierna hábil en ficha deportiva. */
export const actualizarDatosJugadorEquipo = async (teamId, userId, viewerId, payload = {}) => {
  const team = await Team.findByPk(teamId, {
    attributes: ['id', 'capitan_id', 'club_id', 'club_division_id', 'sport_id'],
  });
  if (!team) {
    return { ok: false, status: 404, message: 'Equipo no encontrado' };
  }

  const permisosEquipo = await resolverPermisosEquipo(team, viewerId);
  if (!permisosEquipo.puede_gestionar_plantilla) {
    return { ok: false, status: 403, message: 'No tienes permiso para editar datos del jugador' };
  }

  const membresia = await TeamMiembros.findOne({
    where: {
      team_id: teamId,
      user_id: userId,
      estado_invitacion: 'ACEPTADO',
    },
  });
  if (!membresia) {
    return { ok: false, status: 404, message: 'Jugador no encontrado en el equipo' };
  }

  const updatesMiembro = {};
  if (payload.dorsal_habitual !== undefined) {
    const dorsal = parseDorsal(payload.dorsal_habitual);
    if (dorsal === undefined) {
      return { ok: false, status: 400, message: 'Dorsal inválido (usa 0–99)' };
    }
    updatesMiembro.dorsal_habitual = dorsal;
  }
  if (payload.position !== undefined) {
    const pos = typeof payload.position === 'string'
      ? payload.position.trim()
      : payload.position;
    updatesMiembro.position = pos || null;
  }

  if (Object.keys(updatesMiembro).length > 0) {
    await membresia.update(updatesMiembro);
  }

  const statsUpdates = {};
  if (payload.mano_habil !== undefined) {
    const mano = validarManoHabil(payload.mano_habil);
    if (payload.mano_habil !== null && payload.mano_habil !== '' && mano === undefined) {
      return {
        ok: false,
        status: 400,
        message: "mano_habil debe ser 'DERECHA', 'IZQUIERDA' o 'AMBIDIESTRO'",
      };
    }
    statsUpdates.mano_habil = mano;
  }
  if (payload.pierna_habil !== undefined) {
    const pierna = validarManoHabil(payload.pierna_habil);
    if (payload.pierna_habil !== null && payload.pierna_habil !== '' && pierna === undefined) {
      return {
        ok: false,
        status: 400,
        message: "pierna_habil debe ser 'DERECHA', 'IZQUIERDA' o 'AMBIDIESTRO'",
      };
    }
    statsUpdates.pierna_habil = pierna;
  }

  if (Object.keys(statsUpdates).length > 0 && team.sport_id) {
    let registro = await UsuarioStatsPorSport.findOne({
      where: { user_id: userId, sport_id: team.sport_id },
    });
    if (registro) {
      await registro.update(statsUpdates);
    } else {
      await UsuarioStatsPorSport.create({
        user_id: userId,
        sport_id: team.sport_id,
        ...statsUpdates,
      });
    }
  }

  const data = await obtenerDetalleEquipoJugador(userId, teamId, viewerId);
  return { ok: true, data };
};

export const parseUserId = parseId;
export const parseTeamId = parseId;
