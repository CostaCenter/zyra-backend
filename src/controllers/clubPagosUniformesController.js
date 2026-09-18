import {
  listarConceptosPago,
  crearConceptoPago,
  actualizarConceptoPago,
  listarPagosMiembroClub,
  registrarPagoMiembro,
  actualizarPagoMiembro,
  listarMisPagosClub,
  listarPrendasUniforme,
  crearPrendaUniforme,
  listarUniformesClub,
  asignarUniforme,
  actualizarUniforme,
  obtenerHistorialUniforme,
  obtenerMiUniformeClub,
  obtenerPlantillaWhatsappPago,
  actualizarPlantillaWhatsappPago,
  enviarRecordatorioPagoManual,
  obtenerMensajeWhatsappPago,
} from '../services/clubPagosUniformesService.js';
import { parseId } from '../services/clubsService.js';

function handleServiceResult(res, result) {
  if (!result.ok) {
    return res.status(result.status || 400).json({
      success: false,
      message: result.error || 'Error en la operación',
    });
  }
  return res.status(200).json({ success: true, data: result.data });
}

export const getConceptosPagoClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await listarConceptosPago(clubId, req.userId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('getConceptosPagoClub:', error);
    return res.status(500).json({ success: false, message: 'Error al listar conceptos' });
  }
};

export const postConceptoPagoClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await crearConceptoPago(clubId, req.userId, req.body);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('postConceptoPagoClub:', error);
    return res.status(500).json({ success: false, message: 'Error al crear concepto' });
  }
};

export const patchConceptoPagoClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const conceptoId = parseId(req.params.concepto_id);
    const result = await actualizarConceptoPago(clubId, conceptoId, req.userId, req.body);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('patchConceptoPagoClub:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar concepto' });
  }
};

export const getPagosMiembrosClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await listarPagosMiembroClub(clubId, req.userId, {
      estado: req.query.estado,
      divisionId: req.query.division_id,
    });
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('getPagosMiembrosClub:', error);
    return res.status(500).json({ success: false, message: 'Error al listar pagos' });
  }
};

export const postPagoMiembroClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await registrarPagoMiembro(clubId, req.userId, req.body);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('postPagoMiembroClub:', error);
    return res.status(500).json({ success: false, message: 'Error al registrar pago' });
  }
};

export const putPagoMiembroClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const pagoId = parseId(req.params.pago_id);
    const result = await actualizarPagoMiembro(clubId, pagoId, req.userId, req.body);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('putPagoMiembroClub:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar pago' });
  }
};

export const getMisPagosClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await listarMisPagosClub(clubId, req.userId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('getMisPagosClub:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener pagos' });
  }
};

export const getPrendasUniformeClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await listarPrendasUniforme(clubId, req.userId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('getPrendasUniformeClub:', error);
    return res.status(500).json({ success: false, message: 'Error al listar prendas' });
  }
};

export const postPrendaUniformeClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await crearPrendaUniforme(clubId, req.userId, req.body);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('postPrendaUniformeClub:', error);
    return res.status(500).json({ success: false, message: 'Error al crear prenda' });
  }
};

export const getUniformesClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await listarUniformesClub(clubId, req.userId, {
      divisionId: req.query.division_id,
    });
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('getUniformesClub:', error);
    return res.status(500).json({ success: false, message: 'Error al listar uniformes' });
  }
};

export const postUniformeClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await asignarUniforme(clubId, req.userId, req.body);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('postUniformeClub:', error);
    return res.status(500).json({ success: false, message: 'Error al asignar uniforme' });
  }
};

export const putUniformeClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const asignacionId = parseId(req.params.asignacion_id);
    const result = await actualizarUniforme(clubId, asignacionId, req.userId, req.body);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('putUniformeClub:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar uniforme' });
  }
};

export const getHistorialUniformeClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const asignacionId = parseId(req.params.asignacion_id);
    const result = await obtenerHistorialUniforme(clubId, asignacionId, req.userId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('getHistorialUniformeClub:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener historial' });
  }
};

export const getMiUniformeClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await obtenerMiUniformeClub(clubId, req.userId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('getMiUniformeClub:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener uniforme' });
  }
};

export const getWhatsappPlantillaPagoClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await obtenerPlantillaWhatsappPago(clubId, req.userId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('getWhatsappPlantillaPagoClub:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener plantilla' });
  }
};

export const patchWhatsappPlantillaPagoClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await actualizarPlantillaWhatsappPago(clubId, req.userId, req.body);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('patchWhatsappPlantillaPagoClub:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar plantilla' });
  }
};

export const postRecordatorioPagoClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const pagoId = parseId(req.params.pago_id);
    const result = await enviarRecordatorioPagoManual(clubId, req.userId, pagoId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('postRecordatorioPagoClub:', error);
    return res.status(500).json({ success: false, message: 'Error al enviar recordatorio' });
  }
};

export const getWhatsappMensajePagoClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const pagoId = parseId(req.params.pago_id);
    const result = await obtenerMensajeWhatsappPago(clubId, req.userId, pagoId);
    return handleServiceResult(res, result);
  } catch (error) {
    console.error('getWhatsappMensajePagoClub:', error);
    return res.status(500).json({ success: false, message: 'Error al preparar mensaje' });
  }
};
