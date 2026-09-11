import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../src/db/migrations');

const LOCAL = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '123',
  database: 'zyra',
};

const PENDING = [
  '040_team_categoria_genero.sql',
  '041_publicacion_como_equipo.sql',
];

const client = new pg.Client(LOCAL);

try {
  await client.connect();
  console.log(`→ BD local: ${LOCAL.database}`);

  for (const file of PENDING) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`→ Aplicando ${file}...`);
    await client.query(sql);
    console.log(`✓ ${file}`);
  }

  const { rows } = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE (table_name = 'Team' AND column_name IN ('categoria_edad', 'genero'))
       OR (table_name = 'publicaciones' AND column_name IN ('publicado_como', 'equipo_id'))
    ORDER BY table_name, column_name
  `);
  console.log('Columnas verificadas:', rows);
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
