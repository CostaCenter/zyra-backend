import '../src/config/loadEnv.js';
import sequelize from '../src/config/database.js';

try {
  const [db] = await sequelize.query('SELECT current_database() AS db');
  console.log('BD activa:', db[0].db);

  const checks = [
    ['Team', 'categoria_edad'],
    ['Team', 'genero'],
    ['publicaciones', 'publicado_como'],
    ['publicaciones', 'equipo_id'],
    ['user', 'foto_portada_url'],
  ];

  for (const [table, col] of checks) {
    const [rows] = await sequelize.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = :table AND column_name = :col
    `, { replacements: { table, col } });
    console.log(rows.length ? 'OK' : 'FALTA', `${table}.${col}`);
  }
} finally {
  await sequelize.close();
}
