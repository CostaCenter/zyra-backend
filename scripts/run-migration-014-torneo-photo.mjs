import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  '../src/db/migrations/014_torneo_photo.sql'
);

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('✅ Migración 014 aplicada correctamente.');

  const [rows] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'torneos'
      AND column_name = 'photo'
  `);
  console.log('Columna torneos.photo:', rows.length ? 'OK' : 'FALTA');
} catch (error) {
  console.error('Error aplicando migración 014:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
