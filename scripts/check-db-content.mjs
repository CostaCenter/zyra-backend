import sequelize from '../src/config/database.js';

const count = async (sql) => {
  const [rows] = await sequelize.query(sql);
  return rows[0]?.c ?? rows[0]?.total ?? 0;
};

try {
  console.log('=== Estado de la base de datos ===\n');
  console.log('Usuarios total:', await count('SELECT COUNT(*)::int AS c FROM "user"'));
  console.log('Usuarios SEED:', await count(`SELECT COUNT(*)::int AS c FROM "user" WHERE es_dato_prueba=true OR nick LIKE 'SEED_%'`));
  console.log('Publicaciones total:', await count('SELECT COUNT(*)::int AS c FROM publicaciones'));
  console.log('Publicaciones SEED:', await count('SELECT COUNT(*)::int AS c FROM publicaciones WHERE es_dato_prueba=true'));
  console.log('Equipos SEED:', await count(`SELECT COUNT(*)::int AS c FROM "Team" WHERE es_dato_prueba=true OR name LIKE 'SEED_%'`));
  console.log('Partidos SEED:', await count(`SELECT COUNT(*)::int AS c FROM partidos WHERE es_dato_prueba=true OR name LIKE 'SEED_%'`));

  const [pubs] = await sequelize.query(`
    SELECT p.id, u.nick, p.tipo, LEFT(COALESCE(p.caption,''), 40) AS caption, p.es_dato_prueba
    FROM publicaciones p
    JOIN "user" u ON u.id = p.user_id
    ORDER BY p.id DESC
    LIMIT 8
  `);
  console.log('\nÚltimas publicaciones:');
  console.log(JSON.stringify(pubs, null, 2));

  const [users] = await sequelize.query(`
    SELECT id, nick, name, es_dato_prueba FROM "user"
    WHERE nick NOT LIKE 'SEED_%'
    ORDER BY id
    LIMIT 10
  `);
  console.log('\nUsuarios reales (muestra):');
  console.log(JSON.stringify(users, null, 2));
} finally {
  await sequelize.close();
}
