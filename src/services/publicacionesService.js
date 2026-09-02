import { Op, QueryTypes } from 'sequelize';
import {
  User,
  Sports,
  UsuarioStatsPorSport,
  Publicaciones,
  PublicacionDeportes,
  PublicacionEtiquetas,
  Seguidores,
  Partidos,
  PartidoParticipantes,
  TeamMiembros,
  Canchas,
  sequelize
} from '../db/db.js';
import { notificarEtiquetaPendiente } from './notificacionesService.js';

const parseJsonArray = (value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const parseSportIds = (value) =>
  parseJsonArray(value)
    .map((id) => parseInt(id, 10))
    .filter((id) => !Number.isNaN(id));

export const parseEtiquetados = (value) =>
  parseJsonArray(value)
    .map((id) => parseInt(id, 10))
    .filter((id) => !Number.isNaN(id));

export const serializarPublicacion = (publicacion) => {
  const json = publicacion.toJSON ? publicacion.toJSON() : publicacion;
  const autorRaw = json.autor ?? null;

  return {
    id: json.id,
    user_id: json.user_id,
    tipo: json.tipo,
    url_media: json.url_media,
    media_width: json.media_width ?? null,
    media_height: json.media_height ?? null,
    caption: json.caption,
    creado_at: json.creado_at,
    autor: autorRaw
      ? {
          id: autorRaw.id,
          nick: autorRaw.nick,
          name: autorRaw.name,
          photo: autorRaw.photo,
        }
      : null,
    deportes: json.deportes?.map((d) => ({
      id: d.sport?.id ?? d.sport_id,
      name: d.sport?.name ?? null
    })) ?? [],
    etiquetas: json.etiquetas?.map((e) => ({
      id: e.id,
      user_id: e.user_id_etiquetado,
      nick: e.usuarioEtiquetado?.nick ?? null,
      name: e.usuarioEtiquetado?.name ?? null,
      confirmado: e.confirmado
    })) ?? []
  };
};

export const obtenerContadoresUsuario = async (userId) => {
  const [publicaciones, seguidores, seguidos] = await Promise.all([
    Publicaciones.count({ where: { user_id: userId } }),
    Seguidores.count({ where: { seguido_user_id: userId } }),
    Seguidores.count({ where: { seguidor_user_id: userId } })
  ]);

  return { publicaciones, seguidores, seguidos };
};

export const usuarioSigueA = async (seguidorId, seguidoUserId) => {
  if (!seguidorId || !seguidoUserId || seguidorId === seguidoUserId) return false;
  const row = await Seguidores.findOne({
    where: {
      seguidor_user_id: seguidorId,
      seguido_user_id: seguidoUserId
    }
  });
  return Boolean(row);
};

const perfilPorDefecto = (userId, sportId, sport) => ({
  user_id: userId,
  sport_id: sportId,
  elo_oficial: 1.0,
  goles_oficiales: 0,
  partidos_oficiales: 0,
  elo_casual: 1.0,
  goles_casuales: 0,
  partidos_casuales: 0,
  posicion_principal: null,
  pierna_habil: null,
  dorsal_preferido: null,
  configurado: false,
  sport
});

export const obtenerAsistenciasUsuarioPorSport = async (userId, sportId) => {
  const [fila] = await sequelize.query(
    `
    SELECT COALESCE(SUM(pjs.asistencias), 0)::int AS total
    FROM partido_jugador_stats pjs
    INNER JOIN partidos p ON p.id = pjs.partido_id
    WHERE pjs.user_id = :userId
      AND p.sport_id = :sportId
    `,
    {
      replacements: { userId, sportId },
      type: QueryTypes.SELECT,
    }
  );

  return fila?.total ?? 0;
};

export const obtenerFichaDeportiva = async (userId, sportId) => {
  const sport = await Sports.findByPk(sportId, { attributes: ['id', 'name'] });
  if (!sport) return null;

  const [registro, asistencias] = await Promise.all([
    UsuarioStatsPorSport.findOne({
      where: { user_id: userId, sport_id: sportId }
    }),
    obtenerAsistenciasUsuarioPorSport(userId, sportId),
  ]);

  if (!registro) {
    return {
      ...perfilPorDefecto(userId, sportId, sport),
      asistencias,
    };
  }

  return {
    ...registro.toJSON(),
    asistencias,
    configurado: true,
    sport
  };
};

export const obtenerDeportesUsuario = async (userId) => {
  const [todosLosDeportes, statsUsuario] = await Promise.all([
    Sports.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] }),
    UsuarioStatsPorSport.findAll({
      where: { user_id: userId },
      attributes: ['sport_id']
    })
  ]);

  const sportIdsActivos = new Set(statsUsuario.map((s) => s.sport_id));
  return todosLosDeportes.map((sport) => ({
    id: sport.id,
    name: sport.name,
    activo: sportIdsActivos.has(sport.id)
  }));
};

const includesPublicacionDeportes = [
  {
    model: PublicacionDeportes,
    as: 'deportes',
    required: false,
    include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }]
  },
  {
    model: PublicacionEtiquetas,
    as: 'etiquetas',
    required: false,
    include: [{
      model: User,
      as: 'usuarioEtiquetado',
      attributes: ['id', 'nick', 'name']
    }]
  }
];

export const listarPublicacionesFiltradas = async (userId, sportId) => {
  const publicaciones = await Publicaciones.findAll({
    where: { user_id: userId },
    include: [
      {
        model: User,
        as: 'autor',
        attributes: ['id', 'nick', 'name', 'photo'],
        required: false,
      },
      ...includesPublicacionDeportes,
    ],
    order: [['creado_at', 'DESC']]
  });

  if (!sportId) {
    return publicaciones.map(serializarPublicacion);
  }

  return publicaciones
    .filter((pub) => {
      const deportes = pub.deportes ?? [];
      if (deportes.length === 0) return true;
      return deportes.some((d) => d.sport_id === sportId);
    })
    .map(serializarPublicacion);
};

const filtrarPublicacionesPorDeporte = (publicaciones, sportId) => {
  if (!sportId) return publicaciones;
  return publicaciones.filter((pub) => {
    const deportes = pub.deportes ?? [];
    if (deportes.length === 0) return true;
    return deportes.some((d) => d.sport_id === sportId || d.sport?.id === sportId);
  });
};

/** Publicaciones de miembros aceptados del equipo (propias + donde fueron etiquetados). */
export const listarPublicacionesDeEquipo = async (memberIds, sportId) => {
  if (!memberIds.length) return [];

  const [propias, etiquetas] = await Promise.all([
    Publicaciones.findAll({
      where: { user_id: { [Op.in]: memberIds } },
      include: [
        {
          model: User,
          as: 'autor',
          attributes: ['id', 'nick', 'name', 'photo'],
          required: false,
        },
        ...includesPublicacionDeportes,
      ],
      order: [['creado_at', 'DESC']],
      limit: 80,
    }),
    PublicacionEtiquetas.findAll({
      where: { user_id_etiquetado: { [Op.in]: memberIds }, confirmado: true },
      include: [{
        model: Publicaciones,
        as: 'publicacion',
        include: [
          {
            model: User,
            as: 'autor',
            attributes: ['id', 'nick', 'name', 'photo'],
            required: false,
          },
          ...includesPublicacionDeportes,
        ],
      }],
    }),
  ]);

  const unicas = [];
  const vistos = new Set();
  const agregar = (pub) => {
    if (!pub || vistos.has(pub.id)) return;
    vistos.add(pub.id);
    unicas.push(pub);
  };

  propias.forEach(agregar);
  etiquetas.forEach((row) => agregar(row.publicacion));

  unicas.sort((a, b) => new Date(b.creado_at) - new Date(a.creado_at));
  return filtrarPublicacionesPorDeporte(unicas, sportId).map(serializarPublicacion);
};

/** Publicaciones de otros usuarios donde este jugador fue etiquetado (confirmado). */
export const listarPublicacionesDondeEtiquetado = async (userId, sportId) => {
  const etiquetas = await PublicacionEtiquetas.findAll({
    where: { user_id_etiquetado: userId, confirmado: true },
    include: [{
      model: Publicaciones,
      as: 'publicacion',
      include: [
        {
          model: User,
          as: 'autor',
          attributes: ['id', 'nick', 'name', 'photo'],
          required: false,
        },
        ...includesPublicacionDeportes,
      ],
    }],
    order: [['id', 'DESC']]
  });

  const publicaciones = etiquetas
    .map((row) => row.publicacion)
    .filter(Boolean);

  const unicas = [];
  const vistos = new Set();
  publicaciones.forEach((pub) => {
    if (vistos.has(pub.id)) return;
    vistos.add(pub.id);
    unicas.push(pub);
  });

  return filtrarPublicacionesPorDeporte(unicas, sportId).map(serializarPublicacion);
};

export const obtenerProximoPartido = async (userId, sportId) => {
  const ahora = new Date();
  const estadosActivos = ['PROGRAMADO', 'pendiente', 'por confirmar marcador', 'En cursor'];

  const equiposUsuario = await TeamMiembros.findAll({
    where: { user_id: userId, estado_invitacion: 'ACEPTADO' },
    attributes: ['team_id']
  });
  const teamIds = equiposUsuario.map((m) => m.team_id);

  const whereBase = {
    datetime: { [Op.gte]: ahora },
    state: { [Op.in]: estadosActivos }
  };

  if (sportId) {
    whereBase.sport_id = sportId;
  }

  const [comoArbitro, comoJugador] = await Promise.all([
    Partidos.findOne({
      where: { ...whereBase, arbitro_asignado_id: userId },
      include: [
        { model: Sports, as: 'sport', attributes: ['id', 'name'] },
        { model: Canchas, as: 'cancha', attributes: ['id', 'nombre'] }
      ],
      order: [['datetime', 'ASC']]
    }),
    teamIds.length > 0
      ? Partidos.findOne({
          where: whereBase,
          include: [
            { model: Sports, as: 'sport', attributes: ['id', 'name'] },
            { model: Canchas, as: 'cancha', attributes: ['id', 'nombre'] },
            {
              model: PartidoParticipantes,
              as: 'participantes',
              required: true,
              where: { team_id: { [Op.in]: teamIds } }
            }
          ],
          order: [['datetime', 'ASC']]
        })
      : null
  ]);

  const candidatos = [comoArbitro, comoJugador].filter(Boolean);
  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const partido = candidatos[0];

  return {
    id: partido.id,
    name: partido.name,
    datetime: partido.datetime,
    state: partido.state,
    sport: partido.sport ? { id: partido.sport.id, name: partido.sport.name } : null,
    cancha: partido.cancha ? { id: partido.cancha.id, nombre: partido.cancha.nombre } : null
  };
};

export const crearPublicacionConRelaciones = async ({
  userId,
  tipo,
  urlMedia,
  caption,
  sportIds,
  etiquetados,
  mediaWidth = null,
  mediaHeight = null
}) => {
  return sequelize.transaction(async (transaction) => {
    const publicacion = await Publicaciones.create({
      user_id: userId,
      tipo,
      url_media: urlMedia,
      caption: caption || null,
      media_width: mediaWidth,
      media_height: mediaHeight
    }, { transaction });

    if (sportIds.length > 0) {
      const deportesValidos = await Sports.findAll({
        where: { id: { [Op.in]: sportIds } },
        attributes: ['id'],
        transaction
      });
      const idsValidos = deportesValidos.map((s) => s.id);
      if (idsValidos.length > 0) {
        await PublicacionDeportes.bulkCreate(
          idsValidos.map((sportId) => ({
            publicacion_id: publicacion.id,
            sport_id: sportId
          })),
          { transaction }
        );
      }
    }

    const etiquetadosUnicos = [...new Set(etiquetados.filter((id) => id !== userId))];
    if (etiquetadosUnicos.length > 0) {
      const [usuariosValidos, autor] = await Promise.all([
        User.findAll({
          where: { id: { [Op.in]: etiquetadosUnicos } },
          attributes: ['id'],
          transaction,
        }),
        User.findByPk(userId, {
          attributes: ['id', 'nick', 'name'],
          transaction,
        }),
      ]);
      if (usuariosValidos.length > 0) {
        const etiquetasCreadas = await PublicacionEtiquetas.bulkCreate(
          usuariosValidos.map((u) => ({
            publicacion_id: publicacion.id,
            user_id_etiquetado: u.id,
            confirmado: false,
          })),
          { transaction, returning: true }
        );

        for (const etiqueta of etiquetasCreadas) {
          await notificarEtiquetaPendiente({
            etiquetaId: etiqueta.id,
            usuarioEtiquetadoId: etiqueta.user_id_etiquetado,
            autor,
            transaction,
          });
        }
      }
    }

    return publicacion;
  });
};

export { parseJsonArray };
