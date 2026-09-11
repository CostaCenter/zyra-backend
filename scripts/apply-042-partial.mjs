import sequelize from '../src/config/database.js';

const stmts = [
  'ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS club_id INTEGER',
  'ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS club_division_id INTEGER',
  'ALTER TABLE partidos ADD COLUMN IF NOT EXISTS programado_por_id INTEGER',
  'ALTER TABLE partido_nominas ADD COLUMN IF NOT EXISTS es_local BOOLEAN',
  'ALTER TABLE partido_nominas DROP CONSTRAINT IF EXISTS uq_partido_team_dorsal_set',
];

for (const s of stmts) {
  try {
    await sequelize.query(s);
    console.log('✓', s);
  } catch (e) {
    console.log('⚠', e.parent?.message || e.message);
  }
}

try {
  await sequelize.query(`
    ALTER TABLE partido_nominas
    ADD CONSTRAINT uq_partido_team_dorsal_bando_set
    UNIQUE (partido_id, team_id, dorsal, set_numero, es_local)
  `);
  console.log('✓ constraint uq_partido_team_dorsal_bando_set');
} catch (e) {
  console.log('⚠ constraint:', e.parent?.message || e.message);
}

await sequelize.close();
