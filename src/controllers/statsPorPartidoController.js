import {
  parseUserId,
  parseTeamId,
  obtenerDetalleEquipoJugador,
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

    const data = await obtenerDetalleEquipoJugador(userId, teamId);

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
