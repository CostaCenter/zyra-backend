import sequelize from '../src/config/database.js';

const q = async (label, sql) => {
  const [rows] = await sequelize.query(sql);
  console.log(`\n=== ${label} ===`);
  console.table(rows);
  return rows;
};

try {
  await q('Super Kabo', `
    SELECT id, name, capitan_id, sport_id FROM "Team"
    WHERE name ILIKE '%super kabo%'
    ORDER BY id DESC
  `);

  await q('Usuarios ya en plantillas torneo 20', `
    SELECT DISTINCT tp.user_id, u.nick, t.name AS team_name
    FROM torneo_plantilla tp
    JOIN "user" u ON u.id = tp.user_id
    JOIN "Team" t ON t.id = tp.team_id
    WHERE tp.torneo_id = 20
    ORDER BY tp.user_id
  `);

  await q('Usuarios SEED_Eliz sin uso en torneo 20', `
    SELECT u.id, u.nick, u.name
    FROM "user" u
    WHERE u.nick LIKE 'SEED_Eliz_%'
      AND u.id NOT IN (
        SELECT user_id FROM torneo_plantilla WHERE torneo_id = 20
      )
    ORDER BY u.id
    LIMIT 20
  `);
} finally {
  await sequelize.close();
}
