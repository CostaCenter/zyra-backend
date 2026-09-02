import sequelize from '../src/config/database.js';

try {
  const [teams] = await sequelize.query(
    `SELECT id, name, capitan_id, sport_id FROM "Team" WHERE name ILIKE '%apex%'`
  );
  console.log('Teams Apex:', teams);

  const [users] = await sequelize.query(
    `SELECT id, name, nick, email, telefono FROM "user"
     WHERE name ILIKE '%andres%' OR nick ILIKE '%andres%' OR email ILIKE '%andres%'
     ORDER BY id`
  );
  console.log('Users Andres:', users);

  if (teams[0]) {
    const teamId = teams[0].id;
    const [miembros] = await sequelize.query(
      `SELECT tm.id, tm.user_id, tm.rol, u.name, u.nick
       FROM "Team_Miembros" tm
       JOIN "user" u ON u.id = tm.user_id
       WHERE tm.team_id = :teamId
       ORDER BY tm.id`,
      { replacements: { teamId } }
    );
    console.log('Miembros actuales:', miembros);

    const [capitan] = await sequelize.query(
      `SELECT id, name, nick FROM "user" WHERE id = :id`,
      { replacements: { id: teams[0].capitan_id } }
    );
    console.log('Capitan actual:', capitan);
  }

  const [otrosUsers] = await sequelize.query(
    `SELECT id, name, nick, email, telefono FROM "user" ORDER BY id LIMIT 20`
  );
  console.log('Primeros usuarios:', otrosUsers);
} finally {
  await sequelize.close();
}
