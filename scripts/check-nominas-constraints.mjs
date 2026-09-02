import sequelize from '../src/config/database.js';

try {
  const [defs] = await sequelize.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'partido_nominas'::regclass
    ORDER BY conname
  `);
  console.log('All constraints:');
  for (const d of defs) console.log(`  ${d.conname}: ${d.def}`);

  const [indexes] = await sequelize.query(`
    SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'partido_nominas'
  `);
  console.log('Indexes:');
  for (const idx of indexes) console.log(`  ${idx.indexname}: ${idx.indexdef}`);

  const [rows] = await sequelize.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'partido_nominas'::regclass
      AND contype = 'u'
    ORDER BY conname
  `);
  console.log('Unique constraints:', rows.map((r) => r.conname));

  const [cols] = await sequelize.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'partido_nominas' AND column_name = 'set_numero'
  `);
  console.log('set_numero column:', cols.length ? 'YES' : 'NO');

  const [sample] = await sequelize.query(`
    SELECT partido_id, team_id, user_id, dorsal, set_numero, estado_validacion, COUNT(*) AS cnt
    FROM partido_nominas
    GROUP BY partido_id, team_id, user_id, dorsal, set_numero, estado_validacion
    HAVING COUNT(*) > 1
    LIMIT 5
  `);
  console.log('Duplicate rows sample:', sample);
} catch (error) {
  console.error('Error:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
