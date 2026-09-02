import { Op } from 'sequelize';
import {
  User,
  Team,
  Seguidores
} from '../db/db.js';
import { notificarNuevoSeguidor } from '../services/notificacionesService.js';

/**
 * POST /api/seguidores
 * Body: { seguido_user_id? } o { seguido_team_id? }
 */
export const seguir = async (req, res) => {
  try {
    const { seguido_user_id: seguidoUserIdRaw, seguido_team_id: seguidoTeamIdRaw } = req.body;
    const seguidoUserId = seguidoUserIdRaw != null ? parseInt(seguidoUserIdRaw, 10) : null;
    const seguidoTeamId = seguidoTeamIdRaw != null ? parseInt(seguidoTeamIdRaw, 10) : null;

    const tieneUsuario = seguidoUserId && !Number.isNaN(seguidoUserId);
    const tieneEquipo = seguidoTeamId && !Number.isNaN(seguidoTeamId);

    if (tieneUsuario === tieneEquipo) {
      return res.status(400).json({
        success: false,
        message: 'Envía seguido_user_id o seguido_team_id (solo uno)'
      });
    }

    if (tieneUsuario && seguidoUserId === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes seguirte a ti mismo'
      });
    }

    if (tieneUsuario) {
      const usuario = await User.findByPk(seguidoUserId);
      if (!usuario) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      }
    }

    if (tieneEquipo) {
      const equipo = await Team.findByPk(seguidoTeamId);
      if (!equipo) {
        return res.status(404).json({ success: false, message: 'Equipo no encontrado' });
      }
    }

    const where = {
      seguidor_user_id: req.userId,
      ...(tieneUsuario
        ? { seguido_user_id: seguidoUserId, seguido_team_id: null }
        : { seguido_team_id: seguidoTeamId, seguido_user_id: null })
    };

    const existente = await Seguidores.findOne({ where });
    if (existente) {
      return res.status(200).json({
        success: true,
        message: 'Ya sigues este perfil',
        data: existente
      });
    }

    const seguidor = await Seguidores.create(where);

    if (tieneUsuario && seguidoUserId) {
      await notificarNuevoSeguidor({
        seguidorId: req.userId,
        seguidoUserId,
        seguidorUser: req.user,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Ahora sigues este perfil',
      data: seguidor
    });
  } catch (error) {
    console.error('Error en seguir:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al seguir',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE /api/seguidores/:id
 */
export const dejarDeSeguir = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const seguidor = await Seguidores.findByPk(id);
    if (!seguidor) {
      return res.status(404).json({ success: false, message: 'Seguimiento no encontrado' });
    }

    if (seguidor.seguidor_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este seguimiento'
      });
    }

    await seguidor.destroy();

    return res.status(200).json({
      success: true,
      message: 'Dejaste de seguir'
    });
  } catch (error) {
    console.error('Error en dejarDeSeguir:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al dejar de seguir',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/usuarios/:user_id/seguidores
 */
export const listarSeguidores = async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'user_id inválido' });
    }

    const rows = await Seguidores.findAll({
      where: { seguido_user_id: userId },
      include: [{
        model: User,
        as: 'seguidor',
        attributes: ['id', 'nick', 'name', 'photo']
      }],
      order: [['id', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      total: rows.length,
      data: rows.map((r) => ({
        id: r.id,
        usuario: r.seguidor
      }))
    });
  } catch (error) {
    console.error('Error en listarSeguidores:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar seguidores',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/usuarios/:user_id/seguidos
 */
export const listarSeguidos = async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'user_id inválido' });
    }

    const rows = await Seguidores.findAll({
      where: { seguidor_user_id: userId },
      include: [
        {
          model: User,
          as: 'usuarioSeguido',
          attributes: ['id', 'nick', 'name', 'photo'],
          required: false
        },
        {
          model: Team,
          as: 'equipoSeguido',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: [['id', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      total: rows.length,
      data: rows.map((r) => ({
        id: r.id,
        tipo: r.seguido_user_id ? 'USUARIO' : 'EQUIPO',
        usuario: r.usuarioSeguido ?? null,
        equipo: r.equipoSeguido ?? null
      }))
    });
  } catch (error) {
    console.error('Error en listarSeguidos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar seguidos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Busca el registro de seguimiento del viewer hacia el perfil (para botón Seguir).
 */
export const obtenerSeguimientoActual = async (viewerId, targetUserId) => {
  if (!viewerId || viewerId === targetUserId) return null;
  return Seguidores.findOne({
    where: {
      seguidor_user_id: viewerId,
      seguido_user_id: targetUserId
    }
  });
};

export const obtenerSeguimientoEquipo = async (viewerId, teamId) => {
  if (!viewerId || !teamId) return null;
  return Seguidores.findOne({
    where: {
      seguidor_user_id: viewerId,
      seguido_team_id: teamId
    }
  });
};
