/**
 * Añade set_numero a sanciones seed de vóley que no lo tienen.
 * Uso: node scripts/patch-set-numero-sanciones-voley.mjs
 */
import sequelize from '../src/config/database.js';

const PATCHES = [
  { partidoName: 'SEED_Andes vs Smash Norte', setNumero: 3 },
];

try {
  for (const item of PATCHES) {
    const [partidos] = await sequelize.query(
      `SELECT id FROM partidos WHERE name = :name LIMIT 1`,
      { replacements: { name: item.partidoName } }
    );
    const partidoId = partidos[0]?.id;
    if (!partidoId) {
      console.log(`⚠️  Partido no encontrado: ${item.partidoName}`);
      continue;
    }

    const [updated] = await sequelize.query(
      `
      UPDATE eventos_partido ep
      SET detalle_json = detalle_json || jsonb_build_object('set_numero', :setNumero)
      WHERE ep.partido_id = :partidoId
        AND ep.tipo_evento = 'SANCION'
        AND (ep.detalle_json->>'set_numero') IS NULL
      RETURNING ep.id
      `,
      { replacements: { partidoId, setNumero: item.setNumero } }
    );

    console.log(`✅ ${item.partidoName} (#${partidoId}): ${updated.length} sanción(es) actualizada(s)`);
  }
} catch (error) {
  console.error('Error:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
