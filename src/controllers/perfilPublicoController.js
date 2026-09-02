import {
  User,
  Sports
} from '../db/db.js';
import {
  subirImagenPerfil,
  formatearErrorCloudinary,
} from '../services/cloudinaryService.js';
import {
  obtenerContadoresUsuario,
  usuarioSigueA,
  obtenerFichaDeportiva,
  obtenerDeportesUsuario,
  listarPublicacionesFiltradas,
  listarPublicacionesDondeEtiquetado,
  obtenerProximoPartido
} from '../services/publicacionesService.js';
import { obtenerSeguimientoActual } from './seguidoresController.js';
import { listarEquiposConfirmadosUsuario } from '../services/teamsService.js';

const parseSportId = (value) => {
  const sportId = parseInt(value, 10);
  return Number.isNaN(sportId) ? null : sportId;
};

/**
 * GET /api/usuarios/:user_id/perfil?sport_id=X
 */
export const getPerfilPublico = async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'user_id inválido' });
    }

    const sportId = req.query.sport_id ? parseSportId(req.query.sport_id) : null;

    const usuario = await User.findByPk(userId, {
      attributes: ['id', 'name', 'nick', 'photo', 'foto_portada_url', 'bio', 'deporte_principal_id', 'role'],
      include: [{
        model: Sports,
        as: 'deportePrincipal',
        attributes: ['id', 'name'],
        required: false
      }]
    });

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const deportes = await obtenerDeportesUsuario(userId);
    const deportesActivos = deportes.filter((d) => d.activo);
    const deporteActivoId =
      sportId ??
      usuario.deporte_principal_id ??
      deportesActivos[0]?.id ??
      null;

    const [contadores, publicaciones, publicacionesEtiquetas, ficha, proximoPartido, seguimiento] =
      await Promise.all([
        obtenerContadoresUsuario(userId),
        listarPublicacionesFiltradas(userId, deporteActivoId),
        listarPublicacionesDondeEtiquetado(userId, deporteActivoId),
        deporteActivoId ? obtenerFichaDeportiva(userId, deporteActivoId) : null,
        deporteActivoId ? obtenerProximoPartido(userId, deporteActivoId) : null,
        obtenerSeguimientoActual(req.userId, userId)
      ]);

    const esPropio = req.userId === userId;
    const siguiendo = req.userId ? await usuarioSigueA(req.userId, userId) : false;

    return res.status(200).json({
      success: true,
      data: {
        usuario: {
          id: usuario.id,
          name: usuario.name,
          nick: usuario.nick,
          photo: usuario.photo,
          foto_portada_url: usuario.foto_portada_url,
          bio: usuario.bio,
          deporte_principal_id: usuario.deporte_principal_id,
          deporte_principal: usuario.deportePrincipal ?? null
        },
        contadores,
        deportes,
        sport_id_activo: deporteActivoId,
        ficha_deportiva: ficha,
        publicaciones,
        publicaciones_etiquetas: publicacionesEtiquetas,
        proximo_partido: publicaciones.length === 0 ? proximoPartido : null,
        social: {
          es_propio: esPropio,
          siguiendo,
          seguimiento_id: seguimiento?.id ?? null
        }
      }
    });
  } catch (error) {
    console.error('Error en getPerfilPublico:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfil público',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/usuarios/:user_id/seguidores — re-export para rutas usuarios
 */
export { listarSeguidores, listarSeguidos } from './seguidoresController.js';

/**
 * GET /api/usuarios/:user_id/equipos?sport_id=X
 * Equipos confirmados de un jugador, filtrados por deporte.
 */
export const getEquiposUsuario = async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'user_id inválido' });
    }

    const sportId = req.query.sport_id ? parseSportId(req.query.sport_id) : null;
    const data = await listarEquiposConfirmadosUsuario(userId, sportId);

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error('Error en getEquiposUsuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener equipos del usuario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/usuarios/mi-perfil
 */
export const getMiPerfil = async (req, res) => {
  try {
    const usuario = await User.findByPk(req.userId, {
      attributes: ['id', 'name', 'nick', 'photo', 'foto_portada_url', 'bio', 'deporte_principal_id', 'telefono']
    });

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    return res.status(200).json({
      success: true,
      data: usuario
    });
  } catch (error) {
    console.error('Error en getMiPerfil:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/usuarios/mi-perfil
 * Body: { bio?: string | null, name?: string }
 */
export const updateMiPerfil = async (req, res) => {
  try {
    const usuario = await User.findByPk(req.userId);

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (req.body.name !== undefined) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El nombre debe tener al menos 2 caracteres',
        });
      }
      if (name.length > 80) {
        return res.status(400).json({
          success: false,
          message: 'El nombre no puede superar 80 caracteres',
        });
      }
      usuario.name = name;
    }

    if (req.body.bio !== undefined) {
      const bio = typeof req.body.bio === 'string' ? req.body.bio.trim() : null;
      if (bio && bio.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'La bio no puede superar 500 caracteres'
        });
      }
      usuario.bio = bio || null;
    }

    await usuario.save();

    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado',
      data: {
        id: usuario.id,
        name: usuario.name,
        nick: usuario.nick,
        photo: usuario.photo,
        foto_portada_url: usuario.foto_portada_url,
        bio: usuario.bio,
        deporte_principal_id: usuario.deporte_principal_id,
        telefono: usuario.telefono
      }
    });
  } catch (error) {
    console.error('Error en updateMiPerfil:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/usuarios/mi-perfil/photo
 */
export const updateMiPerfilPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'La imagen photo es obligatoria' });
    }

    const usuario = await User.findByPk(req.userId);
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const upload = await subirImagenPerfil(req.file, 'usuarios');
    usuario.photo = upload.secure_url;
    await usuario.save();

    return res.status(200).json({
      success: true,
      message: 'Foto de perfil actualizada',
      data: {
        id: usuario.id,
        name: usuario.name,
        nick: usuario.nick,
        photo: usuario.photo,
        foto_portada_url: usuario.foto_portada_url,
        bio: usuario.bio,
        deporte_principal_id: usuario.deporte_principal_id,
        telefono: usuario.telefono,
      },
    });
  } catch (error) {
    console.error('Error en updateMiPerfilPhoto:', error);
    return res.status(500).json({
      success: false,
      message: formatearErrorCloudinary(error) || 'Error al subir foto de perfil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/usuarios/mi-perfil/portada
 */
export const updateMiPerfilPortada = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'La imagen photo es obligatoria' });
    }

    const usuario = await User.findByPk(req.userId);
    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const upload = await subirImagenPerfil(req.file, 'usuarios/portadas');
    usuario.foto_portada_url = upload.secure_url;
    await usuario.save();

    return res.status(200).json({
      success: true,
      message: 'Foto de portada actualizada',
      data: {
        id: usuario.id,
        name: usuario.name,
        nick: usuario.nick,
        photo: usuario.photo,
        foto_portada_url: usuario.foto_portada_url,
        bio: usuario.bio,
        deporte_principal_id: usuario.deporte_principal_id,
        telefono: usuario.telefono,
      },
    });
  } catch (error) {
    console.error('Error en updateMiPerfilPortada:', error);
    return res.status(500).json({
      success: false,
      message: formatearErrorCloudinary(error) || 'Error al subir foto de portada',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
