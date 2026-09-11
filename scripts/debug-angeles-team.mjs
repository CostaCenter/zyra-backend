import sequelize from '../src/config/database.js';

try {
  const [teams] = await sequelize.query(`
    SELECT t.id, t.name, t.sport_id, t.capitan_id, s.name AS sport_name
    FROM "Team" t
    LEFT JOIN sports s ON s.id = t.sport_id
    WHERE t.name ILIKE '%angeles%'
    ORDER BY t.id DESC
  `);

  console.log('Equipos Angeles:', JSON.stringify(teams, null, 2));

  if (teams.length) {
    const ids = teams.map((t) => t.id);
    const [miembros] = await sequelize.query(`
      SELECT tm.id, tm.team_id, tm.user_id, tm.rol, tm.estado_invitacion, u.nick, u.name
      FROM "Team_Miembros" tm
      LEFT JOIN "user" u ON u.id = tm.user_id
      WHERE tm.team_id IN (${ids.join(',')})
    `);
    console.log('Miembros:', JSON.stringify(miembros, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
