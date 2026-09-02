import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  '../src/db/migrations/010_arbitro_asignado.sql'
);

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('Migración 010 aplicada correctamente.');

  const [columns] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'partidos' AND column_name = 'arbitro_asignado_id'
  `);
  console.log('arbitro_asignado_id:', columns.length ? 'OK' : 'FALTA');
} catch (error) {
  console.error('Error aplicando migración:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
