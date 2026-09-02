import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, '../src/db/migrations/026_torneo_plantilla_config.sql');

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('✅ Migración 026 (torneo_plantilla_config) aplicada correctamente.');
} catch (error) {
  console.error('Error:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
