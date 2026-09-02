import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  '../src/db/migrations/add_cancha_id_to_configuracion_horarios_favoritos.sql'
);

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('Migración aplicada correctamente.');

  const [columns] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'configuracion_horarios_favoritos'
    ORDER BY ordinal_position
  `);
  console.log('Columnas actuales:', columns.map((c) => c.column_name).join(', '));
} catch (error) {
  console.error('Error aplicando migración:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
