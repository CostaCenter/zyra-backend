import sequelize from '../src/config/database.js';

try {
  const [clubs] = await sequelize.query(
    `SELECT id, nombre, admin_id FROM clubs WHERE nombre ILIKE '%zyra%' ORDER BY id`,
  );
  console.log('Clubs:', clubs);

  const club = clubs.find((c) => c.nombre === 'Zyra Club') ?? clubs[0];
  if (!club) {
    console.log('No club found');
    process.exit(1);
  }

  const clubId = club.id;
  const [divs] = await sequelize.query(
    `SELECT id, nombre, encargado_id FROM club_divisiones WHERE club_id = :clubId ORDER BY id`,
    { replacements: { clubId } },
  );
  console.log('Divisiones:', divs);

  const [teams] = await sequelize.query(
    `SELECT id, name, club_division_id, capitan_id FROM "Team"
     WHERE club_id = :clubId ORDER BY club_division_id, id`,
    { replacements: { clubId } },
  );
  console.log('Equipos:', teams);

  const divIds = divs.map((d) => d.id);
  if (divIds.length) {
    const [atletas] = await sequelize.query(
      `SELECT club_division_id, COUNT(*)::int AS n FROM club_division_atletas
       WHERE club_division_id = ANY(ARRAY[${divIds.join(',')}])
       GROUP BY club_division_id`,
    );
    console.log('Atletas por division:', atletas);
  }

  const [userCount] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM "user"`);
  console.log('Total users:', userCount[0].n);

  const [seedUsers] = await sequelize.query(
    `SELECT id, nick, name FROM "user"
     WHERE nick ~ '^jugador[0-9]+' OR nick ~ '^seed'
     ORDER BY id LIMIT 100`,
  );
  console.log('Seed users count:', seedUsers.length);

  const [usedInClub] = await sequelize.query(
    `SELECT DISTINCT cda.usuario_id, cda.club_division_id, cd.nombre
     FROM club_division_atletas cda
     JOIN club_divisiones cd ON cd.id = cda.club_division_id
     WHERE cd.club_id = :clubId`,
    { replacements: { clubId } },
  );
  console.log('Existing atletas in club:', usedInClub.length);
} finally {
  await sequelize.close();
}
