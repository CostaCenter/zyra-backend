import { Op, UniqueConstraintError } from 'sequelize';
import {
  ContenidoReacciones,
  ContenidoComentarios,
  ContenidoReportes,
  Encuestas,
  EncuestaOpciones,
  EncuestaVotos,
  Publicaciones,
  ClubAnuncios,
  Clubs,
  User,
  sequelize,
} from '../db/db.js';
import { usuarioEsAdminClub } from './clubsService.js';
import {
  notificarComentarioAviso,
  notificarComentarioPublicacion,
  notificarReaccionAviso,
  notificarReaccionPublicacion,
} from './notificacionesService.js';
import { scheduleSideEffect } from '../utils/scheduleSideEffect.js';

async function resolverDestinatariosAnuncio(anuncio) {
  const { resolverDestinatariosAnuncio: resolver } = await import('./clubGestionService.js');
  return resolver(anuncio);
}

export const CONTENIDO_TIPOS = ['AVISO', 'PUBLICACION'];
export const CONTENIDO_TIPOS_REACCION = ['AVISO', 'PUBLICACION', 'COMENTARIO'];
export const CONTENIDO_TIPOS_REPORTE = ['AVISO', 'PUBLICACION', 'COMENTARIO'];
export const TIPOS_REACCION = ['FUEGO', 'FUERZA', 'APLAUSOS', 'RISA', 'CORAZON'];
export const MOTIVOS_REPORTE = [
  'SPAM',
  'ACOSO',
  'CONTENIDO_INAPROPIADO',
  'DISCURSO_ODIO',
  'INFORMACION_FALSA',
  'OTRO',
];

export const REACCION_EMOJI = {
  FUEGO: '🔥',
  FUERZA: '💪',
  APLAUSOS: '👏',
  RISA: '😂',
  CORAZON: '❤️',
};

export function normalizarContenidoTipo(valor, allowed = CONTENIDO_TIPOS) {
  const tipo = String(valor ?? '').trim().toUpperCase();
  if (!allowed.includes(tipo)) {
    return {
      ok: false,
      status: 400,
      error: `contenido_tipo inválido (${allowed.join(' | ')})`,
    };
  }
  return { ok: true, tipo };
}

export function esTipoReaccionValido(tipo) {
  return TIPOS_REACCION.includes(String(tipo ?? '').trim().toUpperCase());
}

function mapReaccionesPorTipo(rows) {
  const porTipo = Object.fromEntries(TIPOS_REACCION.map((t) => [t, 0]));
  rows.forEach((row) => {
    const tipo = row.tipo_reaccion ?? row.get?.('tipo_reaccion');
    if (tipo && porTipo[tipo] != null) porTipo[tipo] += 1;
  });
  return porTipo;
}

function buildReaccionesResumen(rows, userId = null) {
  let miReaccion = null;
  if (userId) {
    const propia = rows.find((r) => r.usuario_id === userId);
    miReaccion = propia?.tipo_reaccion ?? null;
  }
  return {
    total: rows.length,
    por_tipo: mapReaccionesPorTipo(rows),
    mi_reaccion: miReaccion,
  };
}

function mapAutor(user) {
  if (!user) return null;
  return {
    id: user.id,
    nick: user.nick,
    name: user.name,
    photo: user.photo,
  };
}

async function obtenerContenido(contenidoTipo, contenidoId) {
  if (contenidoTipo === 'PUBLICACION') {
    const pub = await Publicaciones.findByPk(contenidoId, {
      attributes: ['id', 'user_id'],
    });
    if (!pub) return { ok: false, status: 404, error: 'Publicación no encontrada' };
    return { ok: true, autorId: pub.user_id };
  }

  if (contenidoTipo === 'COMENTARIO') {
    const comentario = await ContenidoComentarios.findByPk(contenidoId, {
      attributes: ['id', 'usuario_id', 'contenido_tipo', 'contenido_id', 'comentario_padre_id'],
    });
    if (!comentario) return { ok: false, status: 404, error: 'Comentario no encontrado' };
    return {
      ok: true,
      autorId: comentario.usuario_id,
      comentario,
      parentTipo: comentario.contenido_tipo,
      parentId: comentario.contenido_id,
    };
  }

  const anuncio = await ClubAnuncios.findByPk(contenidoId, {
    attributes: ['id', 'autor_id', 'club_id', 'club_division_id', 'equipo_id'],
  });
  if (!anuncio) return { ok: false, status: 404, error: 'Aviso no encontrado' };
  return { ok: true, autorId: anuncio.autor_id, anuncio };
}

async function usuarioPuedeInteractuar(contenidoTipo, contenidoId, userId) {
  if (!userId) return { ok: false, status: 401, error: 'No autenticado' };

  if (contenidoTipo === 'COMENTARIO') {
    const contenido = await obtenerContenido('COMENTARIO', contenidoId);
    if (!contenido.ok) return contenido;

    const permisoPadre = await usuarioPuedeInteractuar(
      contenido.parentTipo,
      contenido.parentId,
      userId,
    );
    if (!permisoPadre.ok) return permisoPadre;

    return {
      ...permisoPadre,
      autorId: contenido.autorId,
      comentario: contenido.comentario,
      parentTipo: contenido.parentTipo,
      parentId: contenido.parentId,
    };
  }

  const contenido = await obtenerContenido(contenidoTipo, contenidoId);
  if (!contenido.ok) return contenido;

  if (contenidoTipo === 'PUBLICACION') {
    return { ok: true, autorId: contenido.autorId };
  }

  const club = await Clubs.findByPk(contenido.anuncio.club_id, {
    attributes: ['id', 'admin_id'],
  });
  const esAdminClub = usuarioEsAdminClub(club, userId);

  if (!esAdminClub) {
    const destinatarios = await resolverDestinatariosAnuncio(contenido.anuncio);
    if (!destinatarios.includes(userId)) {
      return { ok: false, status: 403, error: 'No tienes acceso a este aviso' };
    }
  }

  return {
    ok: true,
    autorId: contenido.autorId,
    anuncio: contenido.anuncio,
    club,
    esAdminClub,
  };
}

export async function obtenerResumenInteraccion(contenidoTipoRaw, contenidoIdRaw, userId = null) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw);
  if (!norm.ok) return norm;

  const contenidoId = parseInt(contenidoIdRaw, 10);
  if (!contenidoId || Number.isNaN(contenidoId)) {
    return { ok: false, status: 400, error: 'contenido_id inválido' };
  }

  const contenido = await obtenerContenido(norm.tipo, contenidoId);
  if (!contenido.ok) return contenido;

  const where = { contenido_tipo: norm.tipo, contenido_id: contenidoId };

  const [reacciones, comentariosTotal, encuesta] = await Promise.all([
    ContenidoReacciones.findAll({ where, attributes: ['tipo_reaccion', 'usuario_id'] }),
    ContenidoComentarios.count({
      where: { ...where, comentario_padre_id: null },
    }),
    Encuestas.findOne({
      where,
      include: [{ model: EncuestaOpciones, as: 'opciones', separate: true, order: [['orden', 'ASC']] }],
    }),
  ]);

  let encuestaData = null;
  if (encuesta) {
    encuestaData = await serializarEncuestaResultados(encuesta, userId);
  }

  return {
    ok: true,
    data: {
      contenido_tipo: norm.tipo,
      contenido_id: contenidoId,
      reacciones: buildReaccionesResumen(reacciones, userId),
      comentarios_total: comentariosTotal,
      encuesta: encuestaData,
    },
  };
}

export async function enriquecerInteraccionesBatch(contenidoTipoRaw, contenidoIds, userId = null) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw);
  if (!norm.ok || !contenidoIds?.length) return new Map();

  const ids = [...new Set(contenidoIds.map((id) => parseInt(id, 10)).filter(Boolean))];
  if (!ids.length) return new Map();

  const where = {
    contenido_tipo: norm.tipo,
    contenido_id: { [Op.in]: ids },
  };

  const [reacciones, comentariosAgg, encuestas] = await Promise.all([
    ContenidoReacciones.findAll({
      where,
      attributes: ['contenido_id', 'tipo_reaccion', 'usuario_id'],
    }),
    ContenidoComentarios.findAll({
      where: { ...where, comentario_padre_id: null },
      attributes: ['contenido_id', [ContenidoComentarios.sequelize.fn('COUNT', '*'), 'total']],
      group: ['contenido_id'],
      raw: true,
    }),
    Encuestas.findAll({
      where,
      include: [{ model: EncuestaOpciones, as: 'opciones', separate: true, order: [['orden', 'ASC']] }],
    }),
  ]);

  const comentariosMap = comentariosAgg.reduce((acc, row) => {
    acc[row.contenido_id] = parseInt(row.total, 10) || 0;
    return acc;
  }, {});

  const reaccionesPorContenido = ids.reduce((acc, id) => {
    acc[id] = {
      total: 0,
      por_tipo: Object.fromEntries(TIPOS_REACCION.map((t) => [t, 0])),
      mi_reaccion: null,
    };
    return acc;
  }, {});

  reacciones.forEach((r) => {
    const bucket = reaccionesPorContenido[r.contenido_id];
    if (!bucket) return;
    bucket.total += 1;
    if (bucket.por_tipo[r.tipo_reaccion] != null) bucket.por_tipo[r.tipo_reaccion] += 1;
    if (userId && r.usuario_id === userId) bucket.mi_reaccion = r.tipo_reaccion;
  });

  const encuestasMap = {};
  for (const enc of encuestas) {
    encuestasMap[enc.contenido_id] = await serializarEncuestaResultados(enc, userId);
  }

  const result = new Map();
  ids.forEach((id) => {
    const rx = reaccionesPorContenido[id];
    result.set(id, {
      stats: {
        reacciones: rx.total,
        comentarios: comentariosMap[id] ?? 0,
      },
      reacciones: rx,
      encuesta: encuestasMap[id] ?? null,
    });
  });

  return result;
}

export async function setReaccion(contenidoTipoRaw, contenidoIdRaw, userId, tipoReaccionRaw) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw, CONTENIDO_TIPOS_REACCION);
  if (!norm.ok) return norm;

  const contenidoId = parseInt(contenidoIdRaw, 10);
  if (!contenidoId || Number.isNaN(contenidoId)) {
    return { ok: false, status: 400, error: 'contenido_id inválido' };
  }

  const permiso = await usuarioPuedeInteractuar(norm.tipo, contenidoId, userId);
  if (!permiso.ok) return permiso;

  const tipoReaccion = String(tipoReaccionRaw ?? '').trim().toUpperCase();
  if (!esTipoReaccionValido(tipoReaccion)) {
    return { ok: false, status: 400, error: 'tipo_reaccion inválido' };
  }

  const where = {
    contenido_tipo: norm.tipo,
    contenido_id: contenidoId,
    usuario_id: userId,
  };

  return sequelize.transaction(async (transaction) => {
    const existente = await ContenidoReacciones.findOne({ where, transaction });

    let accion;
    let miReaccion;

    if (existente) {
      if (existente.tipo_reaccion === tipoReaccion) {
        await existente.destroy({ transaction });
        accion = 'eliminada';
        miReaccion = null;
      } else {
        await existente.update({ tipo_reaccion: tipoReaccion }, { transaction });
        accion = 'actualizada';
        miReaccion = tipoReaccion;
      }
    } else {
      await ContenidoReacciones.create({
        ...where,
        tipo_reaccion: tipoReaccion,
      }, { transaction });
      accion = 'creada';
      miReaccion = tipoReaccion;
    }

    if (
      accion === 'creada'
      && permiso.autorId
      && permiso.autorId !== userId
      && (norm.tipo === 'AVISO' || norm.tipo === 'PUBLICACION')
    ) {
      const reactor = await User.findByPk(userId, {
        attributes: ['id', 'nick', 'name', 'photo'],
      });
      const esPublicacion = norm.tipo === 'PUBLICACION';
      const label = esPublicacion ? 'reaccion-publicacion' : 'reaccion-aviso';
      const payload = esPublicacion
        ? {
          publicacionId: contenidoId,
          autorPublicacionId: permiso.autorId,
          actor: reactor,
          tipoReaccion,
        }
        : {
          anuncioId: contenidoId,
          autorAvisoId: permiso.autorId,
          actor: reactor,
          tipoReaccion,
        };

      transaction.afterCommit(() => {
        scheduleSideEffect(label, () => (
          esPublicacion
            ? notificarReaccionPublicacion(payload)
            : notificarReaccionAviso(payload)
        ));
      });
    }

    return { ok: true, data: { accion, mi_reaccion: miReaccion } };
  });
}

export async function quitarReaccion(contenidoTipoRaw, contenidoIdRaw, userId) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw, CONTENIDO_TIPOS_REACCION);
  if (!norm.ok) return norm;

  const contenidoId = parseInt(contenidoIdRaw, 10);
  if (!contenidoId || Number.isNaN(contenidoId)) {
    return { ok: false, status: 400, error: 'contenido_id inválido' };
  }

  const permiso = await usuarioPuedeInteractuar(norm.tipo, contenidoId, userId);
  if (!permiso.ok) return permiso;

  await ContenidoReacciones.destroy({
    where: {
      contenido_tipo: norm.tipo,
      contenido_id: contenidoId,
      usuario_id: userId,
    },
  });

  return { ok: true, data: { mi_reaccion: null } };
}

function puedeEliminarComentario(comentario, {
  userId,
  contenidoTipo,
  esAdminClub = false,
  esAutorPublicacion = false,
}) {
  if (comentario.usuario_id === userId) return true;
  if (contenidoTipo === 'AVISO' && esAdminClub) return true;
  if (contenidoTipo === 'PUBLICACION' && esAutorPublicacion) return true;
  return false;
}

function serializarComentarioNodo(row, {
  userId,
  contenidoTipo,
  esAdminClub,
  esAutorPublicacion,
  reaccionesMap,
  esRaiz,
}) {
  const reaccionesRows = reaccionesMap.get(row.id) ?? [];
  return {
    id: row.id,
    texto: row.texto,
    created_at: row.created_at,
    comentario_padre_id: row.comentario_padre_id ?? null,
    es_propio: row.usuario_id === userId,
    autor: mapAutor(row.autor),
    reacciones: buildReaccionesResumen(reaccionesRows, userId),
    puede_eliminar: puedeEliminarComentario(row, {
      userId,
      contenidoTipo,
      esAdminClub,
      esAutorPublicacion,
    }),
    puede_responder: Boolean(esRaiz),
    puede_reportar: Boolean(userId) && row.usuario_id !== userId,
  };
}

export async function listarComentarios(contenidoTipoRaw, contenidoIdRaw, userId, { limit = 30, offset = 0 } = {}) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw);
  if (!norm.ok) return norm;

  const contenidoId = parseInt(contenidoIdRaw, 10);
  if (!contenidoId || Number.isNaN(contenidoId)) {
    return { ok: false, status: 400, error: 'contenido_id inválido' };
  }

  const permiso = await usuarioPuedeInteractuar(norm.tipo, contenidoId, userId);
  if (!permiso.ok) return permiso;

  const lim = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 50);
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  let esAdminClub = Boolean(permiso.esAdminClub);
  if (norm.tipo === 'AVISO' && permiso.anuncio && !permiso.club) {
    const club = await Clubs.findByPk(permiso.anuncio.club_id, { attributes: ['id', 'admin_id'] });
    esAdminClub = usuarioEsAdminClub(club, userId);
  }
  const esAutorPublicacion = norm.tipo === 'PUBLICACION' && permiso.autorId === userId;

  const roots = await ContenidoComentarios.findAll({
    where: {
      contenido_tipo: norm.tipo,
      contenido_id: contenidoId,
      comentario_padre_id: null,
    },
    include: [{
      model: User,
      as: 'autor',
      attributes: ['id', 'nick', 'name', 'photo'],
    }],
    order: [['created_at', 'ASC']],
    limit: lim,
    offset: off,
  });

  const rootIds = roots.map((r) => r.id);
  let respuestas = [];
  if (rootIds.length) {
    respuestas = await ContenidoComentarios.findAll({
      where: { comentario_padre_id: { [Op.in]: rootIds } },
      include: [{
        model: User,
        as: 'autor',
        attributes: ['id', 'nick', 'name', 'photo'],
      }],
      order: [['created_at', 'ASC']],
    });
  }

  const allIds = [...rootIds, ...respuestas.map((r) => r.id)];
  const reaccionesMap = new Map();
  if (allIds.length) {
    const reacciones = await ContenidoReacciones.findAll({
      where: {
        contenido_tipo: 'COMENTARIO',
        contenido_id: { [Op.in]: allIds },
      },
      attributes: ['contenido_id', 'tipo_reaccion', 'usuario_id'],
    });
    reacciones.forEach((r) => {
      if (!reaccionesMap.has(r.contenido_id)) reaccionesMap.set(r.contenido_id, []);
      reaccionesMap.get(r.contenido_id).push(r);
    });
  }

  const respuestasPorPadre = respuestas.reduce((acc, row) => {
    const padreId = row.comentario_padre_id;
    if (!acc[padreId]) acc[padreId] = [];
    acc[padreId].push(row);
    return acc;
  }, {});

  const optsBase = {
    userId,
    contenidoTipo: norm.tipo,
    esAdminClub,
    esAutorPublicacion,
    reaccionesMap,
  };

  return {
    ok: true,
    data: roots.map((root) => ({
      ...serializarComentarioNodo(root, { ...optsBase, esRaiz: true }),
      respuestas: (respuestasPorPadre[root.id] ?? []).map((resp) =>
        serializarComentarioNodo(resp, { ...optsBase, esRaiz: false })),
    })),
  };
}

export async function crearComentario(
  contenidoTipoRaw,
  contenidoIdRaw,
  userId,
  textoRaw,
  comentarioPadreId = null,
) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw);
  if (!norm.ok) return norm;

  const contenidoId = parseInt(contenidoIdRaw, 10);
  if (!contenidoId || Number.isNaN(contenidoId)) {
    return { ok: false, status: 400, error: 'contenido_id inválido' };
  }

  const texto = String(textoRaw ?? '').trim();
  if (!texto) return { ok: false, status: 400, error: 'texto es obligatorio' };
  if (texto.length > 2000) return { ok: false, status: 400, error: 'texto demasiado largo' };

  const permiso = await usuarioPuedeInteractuar(norm.tipo, contenidoId, userId);
  if (!permiso.ok) return permiso;

  let padreId = null;
  let padre = null;
  if (comentarioPadreId != null && comentarioPadreId !== '') {
    padreId = parseInt(comentarioPadreId, 10);
    if (!padreId || Number.isNaN(padreId)) {
      return { ok: false, status: 400, error: 'comentario_padre_id inválido' };
    }

    padre = await ContenidoComentarios.findByPk(padreId);
    if (
      !padre
      || padre.contenido_tipo !== norm.tipo
      || padre.contenido_id !== contenidoId
    ) {
      return { ok: false, status: 400, error: 'comentario_padre inválido' };
    }
    if (padre.comentario_padre_id != null) {
      return { ok: false, status: 400, error: 'Solo se permite un nivel de respuesta' };
    }
  }

  return sequelize.transaction(async (transaction) => {
    const comentario = await ContenidoComentarios.create({
      contenido_tipo: norm.tipo,
      contenido_id: contenidoId,
      usuario_id: userId,
      texto,
      comentario_padre_id: padreId,
    }, { transaction });

    const autor = await User.findByPk(userId, { attributes: ['id', 'nick', 'name', 'photo'] });

    const destinatarios = new Set();
    if (permiso.autorId && permiso.autorId !== userId) {
      destinatarios.add(permiso.autorId);
    }
    if (padre && padre.usuario_id && padre.usuario_id !== userId) {
      destinatarios.add(padre.usuario_id);
    }

    for (const destId of destinatarios) {
      const esPublicacion = norm.tipo === 'PUBLICACION';
      const label = esPublicacion ? 'comentario-publicacion' : 'comentario-aviso';
      const payload = esPublicacion
        ? {
          publicacionId: contenidoId,
          autorPublicacionId: destId,
          comentarista: autor,
          comentarioId: comentario.id,
        }
        : {
          anuncioId: contenidoId,
          autorAvisoId: destId,
          comentarista: autor,
          comentarioId: comentario.id,
        };

      transaction.afterCommit(() => {
        scheduleSideEffect(label, () => (
          esPublicacion
            ? notificarComentarioPublicacion(payload)
            : notificarComentarioAviso(payload)
        ));
      });
    }

    return {
      ok: true,
      data: {
        id: comentario.id,
        texto: comentario.texto,
        created_at: comentario.created_at,
        comentario_padre_id: comentario.comentario_padre_id ?? null,
        es_propio: true,
        autor: mapAutor(autor),
        reacciones: buildReaccionesResumen([], userId),
        puede_eliminar: true,
        puede_responder: padreId == null,
        puede_reportar: false,
        respuestas: [],
      },
    };
  });
}

export async function eliminarComentario(comentarioIdRaw, userId) {
  const comentarioId = parseInt(comentarioIdRaw, 10);
  if (!comentarioId || Number.isNaN(comentarioId)) {
    return { ok: false, status: 400, error: 'comentario_id inválido' };
  }

  const comentario = await ContenidoComentarios.findByPk(comentarioId);
  if (!comentario) return { ok: false, status: 404, error: 'Comentario no encontrado' };

  const permiso = await usuarioPuedeInteractuar(
    comentario.contenido_tipo,
    comentario.contenido_id,
    userId,
  );
  if (!permiso.ok) return permiso;

  let esAdminClub = Boolean(permiso.esAdminClub);
  if (comentario.contenido_tipo === 'AVISO' && permiso.anuncio && !esAdminClub) {
    const club = await Clubs.findByPk(permiso.anuncio.club_id, { attributes: ['id', 'admin_id'] });
    esAdminClub = usuarioEsAdminClub(club, userId);
  }

  const esAutorPublicacion = comentario.contenido_tipo === 'PUBLICACION'
    && permiso.autorId === userId;

  if (!puedeEliminarComentario(comentario, {
    userId,
    contenidoTipo: comentario.contenido_tipo,
    esAdminClub,
    esAutorPublicacion,
  })) {
    return { ok: false, status: 403, error: 'No puedes eliminar este comentario' };
  }

  const respuestas = await ContenidoComentarios.findAll({
    where: { comentario_padre_id: comentarioId },
    attributes: ['id'],
  });
  const idsAfectados = [comentarioId, ...respuestas.map((r) => r.id)];

  await ContenidoReacciones.destroy({
    where: {
      contenido_tipo: 'COMENTARIO',
      contenido_id: { [Op.in]: idsAfectados },
    },
  });

  if (respuestas.length) {
    await ContenidoComentarios.destroy({
      where: { id: { [Op.in]: respuestas.map((r) => r.id) } },
    });
  }

  await comentario.destroy();
  return { ok: true };
}

export async function crearReporte({
  contenidoTipoRaw,
  contenidoIdRaw,
  userId,
  motivoRaw,
}) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw, CONTENIDO_TIPOS_REPORTE);
  if (!norm.ok) return norm;

  const contenidoId = parseInt(contenidoIdRaw, 10);
  if (!contenidoId || Number.isNaN(contenidoId)) {
    return { ok: false, status: 400, error: 'contenido_id inválido' };
  }

  const motivo = String(motivoRaw ?? '').trim().toUpperCase();
  if (!MOTIVOS_REPORTE.includes(motivo)) {
    return {
      ok: false,
      status: 400,
      error: `motivo inválido (${MOTIVOS_REPORTE.join(' | ')})`,
    };
  }

  const permiso = await usuarioPuedeInteractuar(norm.tipo, contenidoId, userId);
  if (!permiso.ok) return permiso;

  if (permiso.autorId === userId) {
    return { ok: false, status: 400, error: 'No puedes reportar tu propio contenido' };
  }

  try {
    const reporte = await ContenidoReportes.create({
      contenido_tipo: norm.tipo,
      contenido_id: contenidoId,
      reportado_por_id: userId,
      motivo,
      estado: 'PENDIENTE',
    });

    return {
      ok: true,
      data: {
        id: reporte.id,
        contenido_tipo: reporte.contenido_tipo,
        contenido_id: reporte.contenido_id,
        motivo: reporte.motivo,
        estado: reporte.estado,
        created_at: reporte.created_at,
      },
    };
  } catch (error) {
    if (error instanceof UniqueConstraintError || error?.name === 'SequelizeUniqueConstraintError') {
      return { ok: false, status: 409, error: 'Ya reportaste este contenido' };
    }
    throw error;
  }
}

export async function crearEncuesta(contenidoTipoRaw, contenidoId, { pregunta, opciones = [] }, transaction = null) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw);
  if (!norm.ok) return norm;

  const preguntaTrim = String(pregunta ?? '').trim();
  if (!preguntaTrim) return { ok: false, error: 'pregunta es obligatoria' };

  const opcionesLimpias = opciones
    .map((o) => String(o ?? '').trim())
    .filter(Boolean);

  if (opcionesLimpias.length < 2 || opcionesLimpias.length > 4) {
    return { ok: false, error: 'La encuesta requiere entre 2 y 4 opciones' };
  }

  const existente = await Encuestas.findOne({
    where: { contenido_tipo: norm.tipo, contenido_id: contenidoId },
    transaction,
  });
  if (existente) return { ok: false, error: 'Ya existe una encuesta para este contenido' };

  const encuesta = await Encuestas.create({
    contenido_tipo: norm.tipo,
    contenido_id: contenidoId,
    pregunta: preguntaTrim,
  }, { transaction });

  await EncuestaOpciones.bulkCreate(
    opcionesLimpias.map((texto_opcion, index) => ({
      encuesta_id: encuesta.id,
      texto_opcion,
      orden: index,
    })),
    { transaction },
  );

  return { ok: true, encuesta };
}

async function serializarEncuestaResultados(encuesta, userId = null) {
  const opciones = encuesta.opciones ?? [];
  const opcionIds = opciones.map((o) => o.id);

  const miVoto = userId
    ? await EncuestaVotos.findOne({
      where: { encuesta_id: encuesta.id, usuario_id: userId },
      attributes: ['encuesta_opcion_id'],
    })
    : null;

  const miVotoOpcionId = miVoto?.encuesta_opcion_id ?? null;
  const revelados = miVotoOpcionId != null;

  if (!revelados) {
    return {
      id: encuesta.id,
      pregunta: encuesta.pregunta,
      resultados_revelados: false,
      total_votos: null,
      mi_voto_opcion_id: null,
      opciones: opciones.map((op) => ({
        id: op.id,
        texto: op.texto_opcion,
      })),
    };
  }

  const votosPorOpcion = opcionIds.length
    ? await EncuestaVotos.findAll({
      where: { encuesta_opcion_id: { [Op.in]: opcionIds } },
      attributes: [
        'encuesta_opcion_id',
        [EncuestaVotos.sequelize.fn('COUNT', '*'), 'total'],
      ],
      group: ['encuesta_opcion_id'],
      raw: true,
    })
    : [];

  const conteoMap = votosPorOpcion.reduce((acc, row) => {
    acc[row.encuesta_opcion_id] = parseInt(row.total, 10) || 0;
    return acc;
  }, {});

  const totalVotos = Object.values(conteoMap).reduce((sum, n) => sum + n, 0);

  return {
    id: encuesta.id,
    pregunta: encuesta.pregunta,
    resultados_revelados: true,
    total_votos: totalVotos,
    mi_voto_opcion_id: miVotoOpcionId,
    opciones: opciones.map((op) => {
      const votos = conteoMap[op.id] ?? 0;
      const porcentaje = totalVotos > 0 ? Math.round((votos / totalVotos) * 100) : 0;
      return {
        id: op.id,
        texto: op.texto_opcion,
        votos,
        porcentaje,
      };
    }),
  };
}

export async function obtenerEncuestaResultados(contenidoTipoRaw, contenidoIdRaw, userId) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw);
  if (!norm.ok) return norm;

  const contenidoId = parseInt(contenidoIdRaw, 10);
  if (!contenidoId || Number.isNaN(contenidoId)) {
    return { ok: false, status: 400, error: 'contenido_id inválido' };
  }

  const permiso = await usuarioPuedeInteractuar(norm.tipo, contenidoId, userId);
  if (!permiso.ok) return permiso;

  const encuesta = await Encuestas.findOne({
    where: { contenido_tipo: norm.tipo, contenido_id: contenidoId },
    include: [{ model: EncuestaOpciones, as: 'opciones', separate: true, order: [['orden', 'ASC']] }],
  });

  if (!encuesta) return { ok: false, status: 404, error: 'Encuesta no encontrada' };

  return { ok: true, data: await serializarEncuestaResultados(encuesta, userId) };
}

export async function votarEncuesta(contenidoTipoRaw, contenidoIdRaw, userId, encuestaOpcionIdRaw) {
  const norm = normalizarContenidoTipo(contenidoTipoRaw);
  if (!norm.ok) return norm;

  const contenidoId = parseInt(contenidoIdRaw, 10);
  const encuestaOpcionId = parseInt(encuestaOpcionIdRaw, 10);
  if (!contenidoId || Number.isNaN(contenidoId) || !encuestaOpcionId || Number.isNaN(encuestaOpcionId)) {
    return { ok: false, status: 400, error: 'IDs inválidos' };
  }

  const permiso = await usuarioPuedeInteractuar(norm.tipo, contenidoId, userId);
  if (!permiso.ok) return permiso;

  const encuesta = await Encuestas.findOne({
    where: { contenido_tipo: norm.tipo, contenido_id: contenidoId },
  });
  if (!encuesta) return { ok: false, status: 404, error: 'Encuesta no encontrada' };

  const opcion = await EncuestaOpciones.findOne({
    where: { id: encuestaOpcionId, encuesta_id: encuesta.id },
  });
  if (!opcion) return { ok: false, status: 400, error: 'Opción inválida' };

  const votoExistente = await EncuestaVotos.findOne({
    where: { encuesta_id: encuesta.id, usuario_id: userId },
  });

  if (votoExistente) {
    if (votoExistente.encuesta_opcion_id !== encuestaOpcionId) {
      await votoExistente.update({ encuesta_opcion_id: encuestaOpcionId });
    }
  } else {
    await EncuestaVotos.create({
      encuesta_id: encuesta.id,
      encuesta_opcion_id: encuestaOpcionId,
      usuario_id: userId,
    });
  }

  const encuestaCompleta = await Encuestas.findByPk(encuesta.id, {
    include: [{ model: EncuestaOpciones, as: 'opciones', separate: true, order: [['orden', 'ASC']] }],
  });

  return { ok: true, data: await serializarEncuestaResultados(encuestaCompleta, userId) };
}
