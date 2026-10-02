import {
  parseUserId,
  parseTeamId,
  obtenerDetalleEquipoJugador,
  actualizarDatosJugadorEquipo,
} from '../services/statsPorPartidoService.js';

/**
 * GET /api/usuarios/:user_id/stats-por-partido?team_id=X
 */
export const getStatsPorPartido = async (req, res) => {
  try {
    const userId = parseUserId(req.params.user_id);
    const teamId = parseTeamId(req.query.team_id);

    if (!userId) {
      return res.status(400).json({ success: false, message: 'user_id inválido' });
    }

    if (!teamId) {
      return res.status(400).json({ success: false, message: 'team_id es obligatorio' });
    }

    const data = await obtenerDetalleEquipoJugador(userId, teamId, req.userId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'El jugador no pertenece a ese equipo',
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error en getStatsPorPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener stats por partido',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/teams/:team_id/jugadores/:user_id/datos
 * Dorsal, posición y mano/pierna hábil (capitán, encargado o admin del club).
 */
export const updateJugadorDatosEquipo = async (req, res) => {
  try {
    const teamId = parseTeamId(req.params.team_id);
    const userId = parseUserId(req.params.user_id);

    if (!teamId) {
      return res.status(400).json({ success: false, message: 'team_id inválido' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, message: 'user_id inválido' });
    }

    const result = await actualizarDatosJugadorEquipo(
      teamId,
      userId,
      req.userId,
      req.body ?? {},
    );

    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Datos del jugador actualizados',
      data: result.data,
    });
  } catch (error) {
    console.error('Error en updateJugadorDatosEquipo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar datos del jugador',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
