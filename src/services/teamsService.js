import { Op, fn, col } from 'sequelize';
import {
  TeamMiembros,
  Team,
  Sports,
  DataTeam,
  PartidoJugadorStats,
  User,
  Seguidores,
  Clubs,
  ClubDivisiones,
} from '../db/db.js';
import { listarPublicacionesDeEquipo } from './publicacionesService.js';

const includeEquipo = (teamWhere = {}) => [
  {
    model: Team,
    as: 'equipo',
    where: teamWhere,
    required: true,
    include: [
      { model: Sports, as: 'sport', attributes: ['id', 'name'] },
      { model: DataTeam, as: 'estadisticas', required: false },
      {
        model: User,
        as: 'capitan',
        attributes: ['id', 'nick', 'name', 'photo'],
        required: false,
      },
    ],
  },
];

const agregarStatsPorEquipo = async (userId, teamIds) => {
  if (!teamIds.length) return {};

  const filas = await PartidoJugadorStats.findAll({
    attributes: [
      'team_id',
      [fn('COALESCE', fn('SUM', col('goles')), 0), 'goles'],
      [fn('COUNT', col('partido_id')), 'partidos'],
    ],
    where: {
      user_id: userId,
      team_id: { [Op.in]: teamIds },
    },
    group: ['team_id'],
    raw: true,
  });

  return filas.reduce((acc, fila) => {
    acc[fila.team_id] = {
      goles: Number(fila.goles) || 0,
      partidos: Number(fila.partidos) || 0,
    };
    return acc;
  }, {});
};

const serializarMembresia = (membresia, statsMap) => {
  const equipo = membresia.equipo.toJSON();
  const statsUsuario = statsMap[equipo.id] ?? { goles: 0, partidos: 0 };
  const statsEquipo = equipo.estadisticas ?? null;

  return {
    id: equipo.id,
    name: equipo.name,
    logo_url: equipo.logo_url,
    url: equipo.url,
    sport_id: equipo.sport_id,
    sport: equipo.sport,
    capitan_id: equipo.capitan_id,
    capitan: equipo.capitan
      ? {
          id: equipo.capitan.id,
          nick: equipo.capitan.nick,
          name: equipo.capitan.name,
          photo: equipo.capitan.photo,
        }
      : null,
    categoria_edad: equipo.categoria_edad ?? null,
    genero: equipo.genero ?? null,
    position: membresia.position,
    miembro_id: membresia.id,
    rol: membresia.rol,
    estado_invitacion: membresia.estado_invitacion,
    stats: {
      goles: statsUsuario.goles,
      partidos: statsUsuario.partidos > 0
        ? statsUsuario.partidos
        : (statsEquipo?.games ?? 0),
    },
  };
};

/**
 * Equipos confirmados (ACEPTADO) de un usuario, opcionalmente filtrados por deporte.
 */
export const listarEquiposConfirmadosUsuario = async (userId, sportId = null) => {
  const teamWhere = sportId ? { sport_id: sportId } : {};

  const membresias = await TeamMiembros.findAll({
    where: {
      user_id: userId,
      estado_invitacion: 'ACEPTADO',
    },
    include: includeEquipo(teamWhere),
    order: [['fecha_union', 'DESC']],
  });

  const teamIds = membresias.map((m) => m.equipo.id);
  const statsMap = await agregarStatsPorEquipo(userId, teamIds);

  return membresias.map((membresia) => serializarMembresia(membresia, statsMap));
};

/**
 * Todos los equipos de un usuario como capitán, opcionalmente de un deporte.
 * Fuente: Team_Miembros (rol CAPITAN) + Team.capitan_id por si la membresía está desfasada.
 */
export const listarEquiposCapitanPorDeporte = async (userId, sportId = null) => {
  const teamWhere = sportId ? { sport_id: sportId } : {};

  const membresias = await TeamMiembros.findAll({
    where: {
      user_id: userId,
      rol: 'CAPITAN',
      estado_invitacion: 'ACEPTADO',
    },
    include: includeEquipo(teamWhere),
    order: [['fecha_union', 'DESC']],
  });

  const statsMap = await agregarStatsPorEquipo(
    userId,
    membresias.map((m) => m.equipo.id)
  );

  const porId = new Map();
  membresias.forEach((membresia) => {
    const equipo = serializarMembresia(membresia, statsMap);
    porId.set(equipo.id, equipo);
  });

  const comoCapitanEnTeam = await Team.findAll({
    where: { capitan_id: userId, ...teamWhere },
    include: [
      { model: Sports, as: 'sport', attributes: ['id', 'name'] },
      {
        model: User,
        as: 'capitan',
        attributes: ['id', 'nick', 'name', 'photo'],
        required: false,
      },
    ],
  });

  comoCapitanEnTeam.forEach((team) => {
    if (porId.has(team.id)) return;
    const json = team.toJSON();
    porId.set(team.id, {
      id: team.id,
      name: team.name,
      logo_url: team.logo_url,
      url: team.url,
      sport_id: team.sport_id,
      sport: json.sport,
      capitan_id: team.capitan_id,
      capitan: json.capitan ?? null,
      categoria_edad: team.categoria_edad ?? null,
      genero: team.genero ?? null,
      rol: 'CAPITAN',
      estado_invitacion: 'ACEPTADO',
      stats: { goles: 0, partidos: 0 },
    });
  });

  return [...porId.values()];
};

const serializarJugadorEquipo = (miembro) => ({
  id: miembro.id,
  user_id: miembro.user_id,
  rol: miembro.rol,
  position: miembro.position,
  dorsal_habitual: miembro.dorsal_habitual,
  usuario: miembro.usuario
    ? {
        id: miembro.usuario.id,
        nick: miembro.usuario.nick,
        name: miembro.usuario.name,
        photo: miembro.usuario.photo,
      }
    : null,
});

/**
 * Perfil público de un equipo: header, jugadores aceptados, seguidores y publicaciones.
 */
export const obtenerPerfilPublicoEquipo = async (teamId, viewerId) => {
  const equipo = await Team.findByPk(teamId, {
    include: [
      { model: Sports, as: 'sport', attributes: ['id', 'name'] },
      { model: DataTeam, as: 'estadisticas', required: false },
      {
        model: Clubs,
        as: 'club',
        required: false,
        attributes: ['id', 'nombre', 'logo_url'],
      },
      {
        model: ClubDivisiones,
        as: 'clubDivision',
        required: false,
        attributes: ['id', 'nombre', 'genero', 'categoria_edad'],
      },
      {
        model: TeamMiembros,
        as: 'miembros',
        required: false,
        include: [{
          model: User,
          as: 'usuario',
          attributes: ['id', 'nick', 'name', 'photo'],
        }],
      },
    ],
  });

  if (!equipo) return null;

  const jugadores = (equipo.miembros ?? [])
    .filter((miembro) => miembro.estado_invitacion === 'ACEPTADO')
    .map(serializarJugadorEquipo)
    .sort((a, b) => {
      if (a.rol === 'CAPITAN' && b.rol !== 'CAPITAN') return -1;
      if (b.rol === 'CAPITAN' && a.rol !== 'CAPITAN') return 1;
      return (a.usuario?.name || '').localeCompare(b.usuario?.name || '');
    });

  const memberIds = jugadores.map((j) => j.user_id).filter(Boolean);
  const [seguidores, seguimiento, publicaciones] = await Promise.all([
    Seguidores.count({ where: { seguido_team_id: teamId } }),
    viewerId
      ? Seguidores.findOne({
          where: { seguidor_user_id: viewerId, seguido_team_id: teamId },
        })
      : null,
    listarPublicacionesDeEquipo(teamId, memberIds, equipo.sport_id),
  ]);

  const generoDisplay = equipo.clubDivision?.genero ?? equipo.genero ?? null;
  const categoriaDisplay = equipo.clubDivision?.categoria_edad ?? equipo.categoria_edad ?? null;

  return {
    equipo: {
      id: equipo.id,
      name: equipo.name,
      logo_url: equipo.logo_url,
      sport: equipo.sport ? { id: equipo.sport.id, name: equipo.sport.name } : null,
      ubicacion: null,
      ciudad_base: equipo.ciudad_base ?? null,
      descripcion: equipo.estadisticas?.descripcion ?? null,
      capitan_id: equipo.capitan_id,
      categoria_edad: categoriaDisplay,
      genero: generoDisplay,
      club: equipo.club
        ? { id: equipo.club.id, nombre: equipo.club.nombre, logo_url: equipo.club.logo_url }
        : null,
      club_division: equipo.clubDivision
        ? {
            id: equipo.clubDivision.id,
            nombre: equipo.clubDivision.nombre,
            genero: equipo.clubDivision.genero,
            categoria_edad: equipo.clubDivision.categoria_edad,
          }
        : null,
    },
    jugadores,
    publicaciones,
    contadores: {
      jugadores: jugadores.length,
      seguidores,
      publicaciones: publicaciones.length,
    },
    social: {
      es_capitan: Number(viewerId) === Number(equipo.capitan_id),
      es_miembro: memberIds.some((id) => Number(id) === Number(viewerId)),
      siguiendo: Boolean(seguimiento),
      seguimiento_id: seguimiento?.id ?? null,
    },
  };
};
