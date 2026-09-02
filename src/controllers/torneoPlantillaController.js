import {
  obtenerPlantillaTorneo,
  actualizarPlantillaTorneo,
} from '../services/torneoPlantillaService.js';

const parseId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
};

/**
 * GET /api/torneos/:torneo_id/equipos/:team_id/plantilla
 */
export const getPlantillaTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const teamId = parseId(req.params.team_id);

    if (!torneoId || !teamId) {
      return res.status(400).json({ success: false, message: 'torneo_id y team_id inválidos' });
    }

    const result = await obtenerPlantillaTorneo(torneoId, teamId, req.userId);
    if (result.error) {
      return res.status(result.error.status).json({ success: false, message: result.error.message });
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getPlantillaTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la plantilla del torneo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/torneos/:torneo_id/equipos/:team_id/plantilla
 * Body: { plantilla: [{ user_id, dorsal_torneo, posicion_torneo, mano_habil_torneo, es_libero }] }
 */
export const putPlantillaTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const teamId = parseId(req.params.team_id);

    if (!torneoId || !teamId) {
      return res.status(400).json({ success: false, message: 'torneo_id y team_id inválidos' });
    }

    const payload = req.body?.plantilla ?? req.body?.dorsales;

    const result = await actualizarPlantillaTorneo(
      torneoId,
      teamId,
      req.userId,
      payload
    );

    if (result.error) {
      return res.status(result.error.status).json({ success: false, message: result.error.message });
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en putPlantillaTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al guardar la configuración del equipo en el torneo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
