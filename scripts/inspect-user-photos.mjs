import sequelize from '../src/config/database.js';

try {
  const [rows] = await sequelize.query(`
    SELECT id, name, nick, photo, foto_portada_url
    FROM "user"
    WHERE LOWER(name) LIKE '%andres%'
       OR LOWER(name) LIKE '%andrés%'
       OR LOWER(name) LIKE '%kevin%'
       OR LOWER(nick) LIKE '%andres%'
       OR LOWER(nick) LIKE '%kevin%'
    ORDER BY id
  `);
  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
