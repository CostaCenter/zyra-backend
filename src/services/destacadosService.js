import { Op, fn, col } from 'sequelize';
import {
  User,
  Team,
  TeamMiembros,
  Seguidores,
  Publicaciones,
  PublicacionDeportes,
  PublicacionEtiquetas,
  Sports,
} from '../db/db.js';
import { serializarPublicacion } from './publicacionesService.js';

const LIMITE_DEFAULT = 10;

const includePublicacion = [
  {
    model: User,
    as: 'autor',
    attributes: ['id', 'nick', 'name', 'photo'],
    where: { status: 'ACTIVO' },
    required: true,
  },
  {
    model: PublicacionDeportes,
    as: 'deportes',
    required: false,
    include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
  },
  {
    model: PublicacionEtiquetas,
    as: 'etiquetas',
    required: false,
    include: [{
      model: User,
      as: 'usuarioEtiquetado',
      attributes: ['id', 'nick', 'name'],
    }],
  },
];

const contarSeguidoresPorIds = async (campo, ids) => {
  if (!ids.length) return {};

  const rows = await Seguidores.findAll({
    attributes: [campo, [fn('COUNT', col('id')), 'count']],
    where: { [campo]: { [Op.in]: ids } },
    group: [campo],
    raw: true,
  });

  const map = {};
  rows.forEach((row) => {
    map[row[campo]] = parseInt(row.count, 10) || 0;
  });
  return map;
};

export const obtenerEquiposDestacados = async (limite = LIMITE_DEFAULT) => {
  const equipos = await Team.findAll({
    where: { [Op.or]: [{ privado: false }, { privado: null }] },
    include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
    order: [['creado_at', 'DESC']],
    limit: Math.max(limite * 3, 30),
  });

  if (!equipos.length) return [];

  const ids = equipos.map((e) => e.id);
  const [seguidoresMap, miembrosRows] = await Promise.all([
    contarSeguidoresPorIds('seguido_team_id', ids),
    TeamMiembros.findAll({
      where: { team_id: { [Op.in]: ids }, estado_invitacion: 'ACEPTADO' },
      attributes: ['team_id'],
    }),
  ]);

  const miembrosMap = {};
  miembrosRows.forEach((m) => {
    miembrosMap[m.team_id] = (miembrosMap[m.team_id] || 0) + 1;
  });

  return equipos
    .map((equipo) => {
      const json = equipo.toJSON();
      return {
        id: json.id,
        name: json.name,
        logo_url: json.logo_url,
        sport: json.sport ?? null,
        miembros_count: miembrosMap[json.id] || 0,
        seguidores_count: seguidoresMap[json.id] || 0,
      };
    })
    .sort((a, b) => {
      if (b.seguidores_count !== a.seguidores_count) {
        return b.seguidores_count - a.seguidores_count;
      }
      if (b.miembros_count !== a.miembros_count) {
        return b.miembros_count - a.miembros_count;
      }
      return 0;
    })
    .slice(0, limite);
};

export const obtenerUsuariosDestacados = async (userId, limite = LIMITE_DEFAULT) => {
  const where = { status: 'ACTIVO' };
  if (userId) {
    where.id = { [Op.ne]: userId };
  }

  const usuarios = await User.findAll({
    where,
    attributes: ['id', 'nick', 'name', 'photo', 'creado_at'],
    order: [['creado_at', 'DESC']],
    limit: Math.max(limite * 3, 30),
  });

  if (!usuarios.length) return [];

  const ids = usuarios.map((u) => u.id);
  const seguidoresMap = await contarSeguidoresPorIds('seguido_user_id', ids);

  return usuarios
    .map((usuario) => {
      const json = usuario.toJSON();
      return {
        id: json.id,
        nick: json.nick,
        name: json.name,
        photo: json.photo,
        seguidores_count: seguidoresMap[json.id] || 0,
        creado_at: json.creado_at,
      };
    })
    .sort((a, b) => {
      if (b.seguidores_count !== a.seguidores_count) {
        return b.seguidores_count - a.seguidores_count;
      }
      return new Date(b.creado_at || 0) - new Date(a.creado_at || 0);
    })
    .slice(0, limite);
};

export const serializarPublicacionReciente = (publicacion) => {
  const base = serializarPublicacion(publicacion);
  const autor = publicacion.autor?.toJSON?.() ?? publicacion.autor ?? null;

  return {
    ...base,
    autor: autor
      ? {
          id: autor.id,
          nick: autor.nick,
          name: autor.name,
          photo: autor.photo,
        }
      : null,
  };
};

export const obtenerPublicacionesRecientes = async (limite = LIMITE_DEFAULT) => {
  const publicaciones = await Publicaciones.findAll({
    include: includePublicacion,
    order: [['creado_at', 'DESC']],
    limit: limite,
  });

  return publicaciones.map(serializarPublicacionReciente);
};

const enriquecerPublicacionesFeed = async (publicaciones, viewerUserId) => {
  if (!publicaciones.length) return [];

  const autorIds = [
    ...new Set(publicaciones.map((p) => p.user_id).filter(Boolean)),
  ];

  let seguimientosMap = {};
  if (viewerUserId && autorIds.length) {
    const seguimientos = await Seguidores.findAll({
      where: {
        seguidor_user_id: viewerUserId,
        seguido_user_id: { [Op.in]: autorIds },
      },
      attributes: ['id', 'seguido_user_id'],
    });
    seguimientosMap = seguimientos.reduce((acc, row) => {
      acc[row.seguido_user_id] = row.id;
      return acc;
    }, {});
  }

  return publicaciones.map((publicacion) => {
    const base = serializarPublicacionReciente(publicacion);
    const autorId = base.autor?.id ?? base.user_id;
    const seguimientoId = seguimientosMap[autorId] ?? null;

    return {
      ...base,
      stats: {
        likes: 0,
        comentarios: 0,
      },
      social: {
        es_propio: viewerUserId === autorId,
        siguiendo: Boolean(seguimientoId),
        seguimiento_id: seguimientoId,
      },
    };
  });
};

export const obtenerPublicacionesFeed = async ({
  cursorId = null,
  limite = LIMITE_DEFAULT,
  viewerUserId = null,
} = {}) => {
  const limit = Math.min(Math.max(parseInt(limite, 10) || LIMITE_DEFAULT, 1), 20);
  let where = {};

  if (cursorId) {
    const cursorPub = await Publicaciones.findByPk(cursorId, {
      attributes: ['id', 'creado_at'],
    });

    if (cursorPub) {
      where = {
        [Op.or]: [
          { creado_at: { [Op.lt]: cursorPub.creado_at } },
          {
            creado_at: cursorPub.creado_at,
            id: { [Op.lt]: cursorPub.id },
          },
        ],
      };
    }
  }

  const rows = await Publicaciones.findAll({
    where,
    include: includePublicacion,
    order: [['creado_at', 'DESC'], ['id', 'DESC']],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const data = await enriquecerPublicacionesFeed(slice, viewerUserId);

  return {
    data,
    next_cursor: data.length ? data[data.length - 1].id : null,
    has_more: hasMore,
  };
};
