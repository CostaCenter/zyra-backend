import { invitarMiembro, listarMiembros, actualizarMiembro } from '../services/miembrosService.js';

/**
 * GET /api/complejos/miembros?complejoId=X
 * Lista miembros e invitaciones del complejo
 */
export const obtenerMiembrosComplejo = async (req, res) => {
  try {
    const complejoId = parseInt(req.query.complejoId, 10);

    if (!complejoId) {
      return res.status(400).json({
        success: false,
        message: 'complejoId es requerido'
      });
    }

    const miembros = await listarMiembros(complejoId, req.user.id);

    return res.status(200).json({
      success: true,
      data: miembros
    });
  } catch (error) {
    console.error('Error al listar miembros:', error);

    const statusCode = error.statusCode ?? 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al listar miembros',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/complejos/miembros/invitar
 * Crea una invitación pendiente para un miembro del staff del complejo
 */
export const invitarMiembroComplejo = async (req, res) => {
  try {
    const { complejoId, nombre, correo, rolBase, permisos } = req.body;

    if (!complejoId) {
      return res.status(400).json({
        success: false,
        message: 'complejoId es requerido'
      });
    }

    if (!correo?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'correo es requerido'
      });
    }

    const invitacion = await invitarMiembro({
      complejoId: parseInt(complejoId, 10),
      nombre,
      correo,
      rolBase: rolBase ?? 'RECEPCIONISTA',
      permisos,
      invitadoPorUserId: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: 'Invitación registrada exitosamente',
      data: invitacion
    });
  } catch (error) {
    console.error('Error al invitar miembro:', error);

    const statusCode = error.statusCode ?? 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al invitar miembro',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/complejos/miembros/:id
 * Actualiza perfil, rol y permisos de un miembro del complejo
 */
export const actualizarMiembroComplejo = async (req, res) => {
  try {
    const miembroId = parseInt(req.params.id, 10);

    if (!miembroId) {
      return res.status(400).json({
        success: false,
        message: 'ID de miembro inválido'
      });
    }

    const { nombre, correo, rolBase, permisos } = req.body;
    const payload = {};

    if (nombre !== undefined) payload.nombre = nombre;
    if (correo !== undefined) payload.correo = correo;
    if (rolBase !== undefined) payload.rolBase = rolBase;
    if (permisos !== undefined) payload.permisos = permisos;

    const miembroActualizado = await actualizarMiembro({
      miembroId,
      requesterUserId: req.user.id,
      ...payload
    });

    return res.status(200).json({
      success: true,
      message: 'Miembro actualizado exitosamente',
      data: miembroActualizado
    });
  } catch (error) {
    console.error('Error al actualizar miembro:', error);

    const statusCode = error.statusCode ?? 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al actualizar miembro',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
