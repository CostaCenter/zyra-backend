import {
  obtenerResumenInteraccion,
  setReaccion,
  quitarReaccion,
  listarComentarios,
  crearComentario,
  eliminarComentario,
  crearReporte,
  obtenerEncuestaResultados,
  votarEncuesta,
} from '../services/interaccionSocialService.js';

function parseId(val) {
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

function respondError(res, result) {
  return res.status(result.status ?? 400).json({ success: false, message: result.error });
}

export const getResumenInteraccion = async (req, res) => {
  try {
    const result = await obtenerResumenInteraccion(
      req.params.contenido_tipo,
      req.params.contenido_id,
      req.userId,
    );
    if (!result.ok) return respondError(res, result);
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getResumenInteraccion:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener interacciones' });
  }
};

export const putReaccion = async (req, res) => {
  try {
    const tipoReaccion = req.body?.tipo_reaccion;
    const contenidoTipo = req.params.contenido_tipo;
    const contenidoId = req.params.contenido_id;

    if (tipoReaccion == null || tipoReaccion === '') {
      const result = await quitarReaccion(contenidoTipo, contenidoId, req.userId);
      if (!result.ok) return respondError(res, result);

      // Resumen solo aplica a AVISO/PUBLICACION (no COMENTARIO)
      let resumen = null;
      if (!['COMENTARIO'].includes(String(contenidoTipo).toUpperCase())) {
        const r = await obtenerResumenInteraccion(contenidoTipo, contenidoId, req.userId);
        resumen = r.data;
      }
      return res.status(200).json({
        success: true,
        data: { ...result.data, resumen },
      });
    }

    const result = await setReaccion(
      contenidoTipo,
      contenidoId,
      req.userId,
      tipoReaccion,
    );
    if (!result.ok) return respondError(res, result);

    let resumen = null;
    if (!['COMENTARIO'].includes(String(contenidoTipo).toUpperCase())) {
      const r = await obtenerResumenInteraccion(contenidoTipo, contenidoId, req.userId);
      resumen = r.data;
    }

    return res.status(200).json({
      success: true,
      data: { ...result.data, resumen },
    });
  } catch (error) {
    console.error('Error en putReaccion:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar reacción' });
  }
};

export const getComentarios = async (req, res) => {
  try {
    const result = await listarComentarios(
      req.params.contenido_tipo,
      req.params.contenido_id,
      req.userId,
      {
        limit: req.query.limit,
        offset: req.query.offset,
      },
    );
    if (!result.ok) return respondError(res, result);
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getComentarios:', error);
    return res.status(500).json({ success: false, message: 'Error al listar comentarios' });
  }
};

export const postComentario = async (req, res) => {
  try {
    const result = await crearComentario(
      req.params.contenido_tipo,
      req.params.contenido_id,
      req.userId,
      req.body?.texto,
      req.body?.comentario_padre_id,
    );
    if (!result.ok) return respondError(res, result);
    return res.status(201).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postComentario:', error);
    return res.status(500).json({ success: false, message: 'Error al crear comentario' });
  }
};

export const deleteComentario = async (req, res) => {
  try {
    const comentarioId = parseId(req.params.comentario_id);
    const result = await eliminarComentario(comentarioId, req.userId);
    if (!result.ok) return respondError(res, result);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error en deleteComentario:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar comentario' });
  }
};

export const postReporte = async (req, res) => {
  try {
    const result = await crearReporte({
      contenidoTipoRaw: req.body?.contenido_tipo ?? req.params.contenido_tipo,
      contenidoIdRaw: req.body?.contenido_id ?? req.params.contenido_id,
      userId: req.userId,
      motivoRaw: req.body?.motivo,
    });
    if (!result.ok) return respondError(res, result);
    return res.status(201).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postReporte:', error);
    return res.status(500).json({ success: false, message: 'Error al registrar reporte' });
  }
};

export const getEncuesta = async (req, res) => {
  try {
    const result = await obtenerEncuestaResultados(
      req.params.contenido_tipo,
      req.params.contenido_id,
      req.userId,
    );
    if (!result.ok) return respondError(res, result);
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getEncuesta:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener encuesta' });
  }
};

export const postVotoEncuesta = async (req, res) => {
  try {
    const result = await votarEncuesta(
      req.params.contenido_tipo,
      req.params.contenido_id,
      req.userId,
      req.body?.encuesta_opcion_id,
    );
    if (!result.ok) return respondError(res, result);
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postVotoEncuesta:', error);
    return res.status(500).json({ success: false, message: 'Error al registrar voto' });
  }
};
