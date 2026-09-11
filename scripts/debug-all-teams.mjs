import sequelize from '../src/config/database.js';

try {
  const [teams55] = await sequelize.query(`SELECT id, name, sport_id, capitan_id FROM "Team" WHERE id >= 54 ORDER BY id`);
  console.log('Teams id>=54:', JSON.stringify(teams55, null, 2));

  const [teams] = await sequelize.query(`
    SELECT t.id, t.name, t.sport_id, t.capitan_id, s.name AS sport_name, t.creado_at
    FROM "Team" t
    LEFT JOIN sports s ON s.id = t.sport_id
    ORDER BY t.id DESC
    LIMIT 30
  `);
  console.log('Ultimos equipos:', JSON.stringify(teams, null, 2));

  const [user1Teams] = await sequelize.query(`
    SELECT tm.team_id, tm.rol, tm.estado_invitacion, t.name, t.sport_id, s.name AS sport
    FROM "Team_Miembros" tm
    JOIN "Team" t ON t.id = tm.team_id
    LEFT JOIN sports s ON s.id = t.sport_id
    WHERE tm.user_id = 1
    ORDER BY tm.fecha_union DESC
  `);
  console.log('Equipos user_id=1:', JSON.stringify(user1Teams, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
