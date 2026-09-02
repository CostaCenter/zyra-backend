import { buscarGlobal } from '../services/buscarService.js';

/**
 * GET /api/buscar?q=X&tipo=todo|personas|equipos|torneos
 * Sin q: descubrir dinámico según tipo (equipos/torneos/publicaciones/personas).
 * Con q: máximo 5 resultados por categoría incluida.
 */
export const getBuscar = async (req, res) => {
  try {
    const query = req.query.q ?? '';
    const tipo = req.query.tipo ?? 'todo';

    const data = await buscarGlobal({
      query,
      tipo,
      userId: req.userId
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error en getBuscar:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al realizar la búsqueda',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
