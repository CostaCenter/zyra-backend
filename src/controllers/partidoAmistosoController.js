import { crearPartidoAmistoso as crearPartidoAmistosoService } from '../services/partidoAmistosoService.js';

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

/**
 * POST /api/partidos/amistoso
 * Body: {
 *   equipo_local_id, equipo_visitante_id,
 *   datetime?, cancha_id?, lugar?,
 *   arbitro_asignado_id?, nivel_arbitraje?
 * }
 */
export const crearPartidoAmistoso = async (req, res) => {
  try {
    const resultado = await crearPartidoAmistosoService({
      userId: req.userId,
      equipoLocalId: req.body?.equipo_local_id,
      equipoVisitanteId: req.body?.equipo_visitante_id,
      datetime: req.body?.datetime,
      canchaId: parseId(req.body?.cancha_id),
      lugar: req.body?.lugar?.trim() || null,
      arbitroId: parseId(req.body?.arbitro_asignado_id),
      nivelArbitraje: req.body?.nivel_arbitraje,
    });

    if (resultado.status !== 201) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Partido amistoso programado',
      data: resultado.data,
    });
  } catch (error) {
    console.error('Error en crearPartidoAmistoso:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al programar partido amistoso',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
