import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, '../src/db/migrations/025_torneo_plantilla_dorsales.sql');

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('✅ Migración 025 (torneo_plantilla_dorsales) aplicada correctamente.');
} catch (error) {
  console.error('Error:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
