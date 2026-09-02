import {
  Publicaciones,
  PublicacionDeportes,
  PublicacionEtiquetas,
  User,
  Sports
} from '../db/db.js';
import {
  subirMediaPublicacion,
  inferirTipoPublicacion,
  formatearErrorCloudinary
} from '../services/cloudinaryService.js';
import {
  crearPublicacionConRelaciones,
  parseSportIds,
  parseEtiquetados,
  serializarPublicacion
} from '../services/publicacionesService.js';
import { obtenerPublicacionesRecientes, obtenerPublicacionesFeed } from '../services/destacadosService.js';

/**
 * POST /api/publicaciones
 * multipart/form-data: media, caption?, sport_ids?, etiquetados?
 */
export const crearPublicacion = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'El archivo media es obligatorio'
      });
    }

    const caption = req.body.caption?.trim() || null;
    const sportIds = parseSportIds(req.body.sport_ids);
    const etiquetados = parseEtiquetados(req.body.etiquetados);

    const upload = await subirMediaPublicacion(req.file);
    const tipo = inferirTipoPublicacion(req.file.mimetype, req.file.originalname);

    if (process.env.NODE_ENV === 'development') {
      console.log('📤 Upload publicación:', {
        tipo,
        mimetype: req.file.mimetype,
        size: req.file.size,
        originalname: req.file.originalname
      });
    }

    const publicacion = await crearPublicacionConRelaciones({
      userId: req.userId,
      tipo,
      urlMedia: upload.secure_url,
      caption,
      sportIds,
      etiquetados,
      mediaWidth: upload.width,
      mediaHeight: upload.height
    });

    const completa = await Publicaciones.findByPk(publicacion.id, {
      include: [
        {
          model: PublicacionDeportes,
          as: 'deportes',
          include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }]
        },
        {
          model: PublicacionEtiquetas,
          as: 'etiquetas',
          include: [{
            model: User,
            as: 'usuarioEtiquetado',
            attributes: ['id', 'nick', 'name']
          }]
        }
      ]
    });

    return res.status(201).json({
      success: true,
      message: 'Publicación creada',
      data: serializarPublicacion(completa)
    });
  } catch (error) {
    console.error('Error en crearPublicacion:', error);
    const mensaje = formatearErrorCloudinary(error);
    const esCloudinary = Boolean(error?.http_code);
    return res.status(esCloudinary ? 422 : 500).json({
      success: false,
      message: mensaje,
      code: esCloudinary ? 'CLOUDINARY_UPLOAD_FAILED' : 'PUBLICACION_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/publicaciones/etiquetas/pendientes
 */
export const listarEtiquetasPendientes = async (req, res) => {
  try {
    const etiquetas = await PublicacionEtiquetas.findAll({
      where: {
        user_id_etiquetado: req.userId,
        confirmado: false
      },
      include: [
        {
          model: Publicaciones,
          as: 'publicacion',
          include: [{
            model: User,
            as: 'autor',
            attributes: ['id', 'nick', 'name', 'photo']
          }]
        }
      ],
      order: [['id', 'DESC']]
    });

    const data = etiquetas.map((et) => ({
      id: et.id,
      confirmado: et.confirmado,
      publicacion: et.publicacion
        ? {
            id: et.publicacion.id,
            tipo: et.publicacion.tipo,
            url_media: et.publicacion.url_media,
            caption: et.publicacion.caption,
            creado_at: et.publicacion.creado_at
          }
        : null,
      autor: et.publicacion?.autor
        ? {
            id: et.publicacion.autor.id,
            nick: et.publicacion.autor.nick,
            name: et.publicacion.autor.name,
            photo: et.publicacion.autor.photo
          }
        : null
    }));

    return res.status(200).json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    console.error('Error en listarEtiquetasPendientes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener etiquetas pendientes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/publicaciones/etiquetas/:id/responder
 * Body: { confirmado: boolean }
 */
export const responderEtiqueta = async (req, res) => {
  try {
    const etiquetaId = parseInt(req.params.id, 10);
    if (Number.isNaN(etiquetaId)) {
      return res.status(400).json({ success: false, message: 'ID de etiqueta inválido' });
    }

    const { confirmado } = req.body;
    if (typeof confirmado !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'confirmado debe ser true o false'
      });
    }

    const etiqueta = await PublicacionEtiquetas.findByPk(etiquetaId);
    if (!etiqueta) {
      return res.status(404).json({ success: false, message: 'Etiqueta no encontrada' });
    }

    if (etiqueta.user_id_etiquetado !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para responder esta etiqueta'
      });
    }

    await etiqueta.update({ confirmado });

    return res.status(200).json({
      success: true,
      message: confirmado ? 'Etiqueta confirmada' : 'Etiqueta rechazada',
      data: etiqueta
    });
  } catch (error) {
    console.error('Error en responderEtiqueta:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al responder etiqueta',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/publicaciones/recientes
 * Publicaciones más recientes de perfiles activos.
 */
export const listarPublicacionesRecientes = async (req, res) => {
  try {
    const limite = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const data = await obtenerPublicacionesRecientes(limite);

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error('Error en listarPublicacionesRecientes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener publicaciones recientes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/publicaciones/feed?cursor=&limit=
 * Feed vertical paginado (publicaciones más recientes primero).
 */
export const listarPublicacionesFeed = async (req, res) => {
  try {
    const limite = Math.min(parseInt(req.query.limit, 10) || 5, 20);
    const cursorRaw = req.query.cursor;
    const cursorId = cursorRaw != null && cursorRaw !== ''
      ? parseInt(cursorRaw, 10)
      : null;

    if (cursorRaw != null && cursorRaw !== '' && Number.isNaN(cursorId)) {
      return res.status(400).json({
        success: false,
        message: 'cursor inválido',
      });
    }

    const result = await obtenerPublicacionesFeed({
      cursorId,
      limite,
      viewerUserId: req.userId,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error en listarPublicacionesFeed:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener feed de publicaciones',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
