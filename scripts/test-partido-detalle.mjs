import sequelize from '../src/config/database.js';
import { obtenerDetalleMarcadorPartido } from '../src/services/partidoDetalleService.js';

const [rows] = await sequelize.query(`
  SELECT id FROM partidos
  WHERE es_dato_prueba = true OR name LIKE 'SEED_%'
  ORDER BY id ASC
  LIMIT 1
`);

const partidoId = rows[0]?.id;
if (!partidoId) {
  console.error('No hay partidos seed');
  process.exit(1);
}

const detalle = await obtenerDetalleMarcadorPartido(partidoId);
console.log(JSON.stringify({
  partido_id: partidoId,
  torneo: detalle.partido.torneo,
  score: `${detalle.partido.score_local_final}-${detalle.partido.score_visitante_final}`,
  parciales: detalle.marcador.parciales_sets,
  tarjetas: detalle.tarjetas,
  arbitro: detalle.partido.arbitro?.name,
}, null, 2));

await sequelize.close();
