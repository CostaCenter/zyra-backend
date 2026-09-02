import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  '../src/db/migrations/011_max_equipos_torneo.sql'
);

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('Migración 011 aplicada correctamente.');

  const [columns] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'torneos' AND column_name = 'max_equipos'
  `);
  console.log('max_equipos:', columns.length ? 'OK' : 'FALTA');
} catch (error) {
  console.error('Error aplicando migración:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
