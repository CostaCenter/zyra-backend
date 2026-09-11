import sequelize from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(
  __dirname,
  '../src/db/migrations/053_club_membresia_solicitudes.sql',
);

try {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await sequelize.query(sql);
  console.log('OK: club_membresia_solicitudes + roles ampliados');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close().catch(() => {});
}
