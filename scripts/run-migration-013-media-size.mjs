import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  '../src/db/migrations/013_publicaciones_media_size.sql'
);

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('✅ Migración 013 aplicada correctamente.');

  const [rows] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'publicaciones'
      AND column_name IN ('media_width', 'media_height')
    ORDER BY column_name
  `);
  console.log('Columnas publicaciones:', rows.map((r) => r.column_name).join(', ') || 'NINGUNA');
} catch (error) {
  console.error('Error aplicando migración 013:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
