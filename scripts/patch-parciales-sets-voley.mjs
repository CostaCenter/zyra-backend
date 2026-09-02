/**
 * Corrige parciales_sets en partidos seed de vóley (puntos por set, no sets ganados).
 * Uso: node scripts/patch-parciales-sets-voley.mjs
 */
import sequelize from '../src/config/database.js';

const ACTUALIZACIONES = [
  {
    partidoId: null,
    name: 'SEED_Andes vs Altura',
    parciales: [[25, 20], [22, 25], [25, 18], [25, 21]],
  },
  {
    partidoId: null,
    name: 'SEED_Andes vs Smash Norte',
    parciales: [[25, 23], [21, 25], [25, 27], [20, 25], [12, 15]],
  },
];

try {
  for (const item of ACTUALIZACIONES) {
    const [rows] = await sequelize.query(
      `SELECT id FROM partidos WHERE name = :name LIMIT 1`,
      { replacements: { name: item.name } }
    );
    const partidoId = rows[0]?.id;
    if (!partidoId) {
      console.warn(`Partido no encontrado: ${item.name}`);
      continue;
    }

    await sequelize.query(
      `
      UPDATE marcadores_detalle
      SET metrica_estructura = jsonb_set(
        COALESCE(metrica_estructura, '{}'::jsonb),
        '{parciales_sets}',
        :parciales::jsonb,
        true
      )
      WHERE partido_id = :partidoId
      `,
      {
        replacements: {
          partidoId,
          parciales: JSON.stringify(item.parciales),
        },
      }
    );

    console.log(`✅ ${item.name} (#${partidoId}): ${item.parciales.length} sets`);
  }
} catch (error) {
  console.error('Error:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
