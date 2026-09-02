import sequelize from '../src/config/database.js';

const partidoId = parseInt(process.argv[2] || '153', 10);

try {
  const [rows] = await sequelize.query(
    `SELECT id, partido_id, team_id, user_id, dorsal, rol_nomina, zona, set_numero, estado_validacion
     FROM partido_nominas
     WHERE partido_id = :partidoId
     ORDER BY set_numero, team_id, rol_nomina, dorsal`,
    { replacements: { partidoId } }
  );
  console.log(`Nominas partido ${partidoId}:`, rows.length);
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }

  const [dupUser] = await sequelize.query(
    `SELECT partido_id, user_id, set_numero, COUNT(*) AS cnt, array_agg(team_id) AS teams
     FROM partido_nominas
     WHERE partido_id = :partidoId
     GROUP BY partido_id, user_id, set_numero
     HAVING COUNT(*) > 1`,
    { replacements: { partidoId } }
  );
  console.log('Same user in multiple teams/rows per set:', dupUser);

  const [dupDorsal] = await sequelize.query(
    `SELECT partido_id, team_id, dorsal, set_numero, COUNT(*) AS cnt
     FROM partido_nominas
     WHERE partido_id = :partidoId
     GROUP BY partido_id, team_id, dorsal, set_numero
     HAVING COUNT(*) > 1`,
    { replacements: { partidoId } }
  );
  console.log('Duplicate dorsal per team/set:', dupDorsal);
} catch (error) {
  console.error('Error:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
