/**
 * Asigna teléfono a usuarios SEED existentes (login usa telefono, no nick).
 * Uso: node scripts/patch-seed-telefonos.mjs
 */
import sequelize from '../src/config/database.js';

try {
  const [rows] = await sequelize.query(`
    SELECT id, nick FROM "user"
    WHERE es_dato_prueba = true OR nick LIKE 'SEED_jugador_%'
    ORDER BY id
  `);

  let updated = 0;
  for (const row of rows) {
    const match = row.nick.match(/SEED_jugador_(\d+)/);
    if (!match) continue;
    const num = match[1];
    const telefono = `300${num.padStart(7, '0')}`;

    await sequelize.query(
      `UPDATE "user" SET telefono = :telefono WHERE id = :id AND (telefono IS NULL OR telefono = '')`,
      { replacements: { telefono, id: row.id } }
    );
    updated += 1;
  }

  console.log(`✅ Teléfonos asignados a ${updated} usuarios SEED.`);
  console.log('Login SEED_jugador_01 → teléfono 30000000001 / SeedZyra2026!');
} catch (error) {
  console.error('Error:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
