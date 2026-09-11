import sequelize from '../src/config/database.js';

const CLUB_ID = 2;

try {
  const [divs] = await sequelize.query(
    `SELECT id, nombre FROM club_divisiones WHERE club_id = :clubId ORDER BY id`,
    { replacements: { clubId: CLUB_ID } },
  );

  const [teams] = await sequelize.query(
    `SELECT id, name, club_division_id FROM "Team" WHERE club_id = :clubId ORDER BY club_division_id, id`,
    { replacements: { clubId: CLUB_ID } },
  );

  const [existingAtletas] = await sequelize.query(
    `SELECT cda.*, u.nick FROM club_division_atletas cda
     JOIN club_divisiones cd ON cd.id = cda.club_division_id
     JOIN "user" u ON u.id = cda.usuario_id
     WHERE cd.club_id = :clubId`,
    { replacements: { clubId: CLUB_ID } },
  );

  const [club] = await sequelize.query(`SELECT admin_id FROM clubs WHERE id = :clubId`, {
    replacements: { clubId: CLUB_ID },
  });
  const adminId = club[0]?.admin_id;

  const [allUsers] = await sequelize.query(
    `SELECT id, nick, name FROM "user" ORDER BY id`,
  );

  const usedIds = new Set(existingAtletas.map((a) => a.usuario_id));
  usedIds.add(adminId);

  const available = allUsers.filter((u) => !usedIds.has(u.id));
  console.log('Divisiones:', divs.length, divs.map((d) => `${d.id}:${d.nombre}`).join(', '));
  console.log('Equipos:', teams.length);
  console.log('Existing atletas:', existingAtletas);
  console.log('Available users (excl admin+existing):', available.length);
  console.log('Need:', divs.length * 14);
  console.log('Sample available:', available.slice(0, 20).map((u) => u.id));
} finally {
  await sequelize.close();
}
