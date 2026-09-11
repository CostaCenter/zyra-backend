import {
  listarDestacadosClub,
  crearDestacadoClub,
  actualizarDestacadoClub,
  eliminarDestacadoClub,
  agregarItemDestacado,
  eliminarItemDestacado,
} from '../services/clubDestacadosService.js';
import { formatearErrorCloudinary } from '../services/cloudinaryService.js';

const responderError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    message: error.message || fallbackMessage,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
};

export const getDestacadosClub = async (req, res) => {
  try {
    const data = await listarDestacadosClub(req.params.club_id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return responderError(res, error, 'Error al listar destacados del club');
  }
};

export const postDestacadoClub = async (req, res) => {
  try {
    const data = await crearDestacadoClub(
      req.params.club_id,
      req.userId,
      {
        nombre: req.body?.nombre,
        orden: req.body?.orden,
      },
      req.file,
    );
    return res.status(201).json({
      success: true,
      message: 'Destacado creado',
      data,
    });
  } catch (error) {
    return responderError(res, error, formatearErrorCloudinary(error) || 'Error al crear destacado');
  }
};

export const putDestacadoClub = async (req, res) => {
  try {
    const data = await actualizarDestacadoClub(
      req.params.club_id,
      req.params.destacado_id,
      req.userId,
      {
        nombre: req.body?.nombre,
        orden: req.body?.orden,
      },
      req.file,
    );
    return res.status(200).json({
      success: true,
      message: 'Destacado actualizado',
      data,
    });
  } catch (error) {
    return responderError(res, error, formatearErrorCloudinary(error) || 'Error al actualizar destacado');
  }
};

export const deleteDestacadoClub = async (req, res) => {
  try {
    await eliminarDestacadoClub(
      req.params.club_id,
      req.params.destacado_id,
      req.userId,
    );
    return res.status(200).json({
      success: true,
      message: 'Destacado eliminado',
    });
  } catch (error) {
    return responderError(res, error, 'Error al eliminar destacado');
  }
};

export const postDestacadoItem = async (req, res) => {
  try {
    const data = await agregarItemDestacado(
      req.params.club_id,
      req.params.destacado_id,
      req.userId,
      req.file,
    );
    return res.status(201).json({
      success: true,
      message: 'Contenido agregado al destacado',
      data,
    });
  } catch (error) {
    return responderError(res, error, formatearErrorCloudinary(error) || 'Error al agregar contenido');
  }
};

export const deleteDestacadoItem = async (req, res) => {
  try {
    await eliminarItemDestacado(
      req.params.club_id,
      req.params.destacado_id,
      req.params.item_id,
      req.userId,
    );
    return res.status(200).json({
      success: true,
      message: 'Contenido eliminado',
    });
  } catch (error) {
    return responderError(res, error, 'Error al eliminar contenido');
  }
};
