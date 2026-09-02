import {
  listarNotificacionesUsuario,
  contarNoLeidas,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  eliminarNotificacion,
  validarCategoriaFiltro,
} from '../services/notificacionesService.js';

export const listarNotificaciones = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const categoriaRaw = req.query.categoria?.trim() || null;

    let categoria = null;
    try {
      categoria = validarCategoriaFiltro(categoriaRaw);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Categoría de filtro inválida',
      });
    }

    const { notificaciones, categorias } = await listarNotificacionesUsuario(req.userId, {
      limit,
      offset,
      categoria,
    });
    const noLeidas = await contarNoLeidas(req.userId);

    return res.status(200).json({
      success: true,
      data: {
        notificaciones,
        categorias,
        no_leidas: noLeidas,
      },
    });
  } catch (error) {
    console.error('Error en listarNotificaciones:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cargar notificaciones',
    });
  }
};

export const obtenerConteoNoLeidas = async (req, res) => {
  try {
    const noLeidas = await contarNoLeidas(req.userId);
    return res.status(200).json({
      success: true,
      data: { no_leidas: noLeidas },
    });
  } catch (error) {
    console.error('Error en obtenerConteoNoLeidas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener conteo de notificaciones',
    });
  }
};

export const marcarLeida = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const notificacion = await marcarNotificacionLeida(id, req.userId);
    if (!notificacion) {
      return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
    }

    const noLeidas = await contarNoLeidas(req.userId);

    return res.status(200).json({
      success: true,
      data: {
        notificacion,
        no_leidas: noLeidas,
      },
    });
  } catch (error) {
    console.error('Error en marcarLeida:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al marcar notificación como leída',
    });
  }
};

export const marcarTodasLeidasHandler = async (req, res) => {
  try {
    await marcarTodasLeidas(req.userId);
    return res.status(200).json({
      success: true,
      data: { no_leidas: 0 },
    });
  } catch (error) {
    console.error('Error en marcarTodasLeidas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al marcar todas como leídas',
    });
  }
};

export const eliminarNotificacionHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, message: 'ID inválido' });
    }

    const resultado = await eliminarNotificacion(id, req.userId);
    if (!resultado) {
      return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
    }

    const noLeidas = await contarNoLeidas(req.userId);

    return res.status(200).json({
      success: true,
      data: {
        id: resultado.id,
        no_leidas: noLeidas,
      },
    });
  } catch (error) {
    console.error('Error en eliminarNotificacion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar notificación',
    });
  }
};
