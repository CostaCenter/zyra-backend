import { Op } from 'sequelize';
import { User } from '../db/db.js';
import { obtenerUsuariosDestacados } from '../services/destacadosService.js';

const LIMITE_BUSQUEDA = 10;

/**
 * GET /api/usuarios/buscar?nick=X
 * Búsqueda parcial de usuarios por nick (case-insensitive).
 */
export const buscarUsuariosPorNick = async (req, res) => {
  try {
    const nick = req.query.nick?.trim();

    if (!nick) {
      return res.status(400).json({
        success: false,
        message: 'El parámetro nick es obligatorio'
      });
    }

    const usuarios = await User.findAll({
      where: {
        id: { [Op.ne]: req.userId },
        nick: { [Op.iLike]: `%${nick}%` }
      },
      attributes: ['id', 'nick', 'name', 'photo'],
      limit: LIMITE_BUSQUEDA,
      order: [['nick', 'ASC']]
    });

    const data = usuarios.map((usuario) => usuario.toJSON());

    return res.status(200).json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    console.error('Error en buscarUsuariosPorNick:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al buscar usuarios',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/usuarios/destacados
 * Usuarios con más seguidores (fallback: más recientes).
 */
export const getUsuariosDestacados = async (req, res) => {
  try {
    const limite = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const data = await obtenerUsuariosDestacados(req.userId, limite);

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error('Error en getUsuariosDestacados:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios destacados',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
