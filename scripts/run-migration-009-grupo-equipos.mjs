import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  '../src/db/migrations/009_grupo_equipos.sql'
);

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('Migración 009 aplicada correctamente.');

  const [tables] = await sequelize.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'grupo_equipos'
  `);
  console.log('tabla grupo_equipos:', tables.length ? 'OK' : 'FALTA');

  const [constraints] = await sequelize.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conname = 'uq_grupo_team'
  `);
  console.log('uq_grupo_team:', constraints.length ? 'OK' : 'FALTA');

  const [indexes] = await sequelize.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'grupo_equipos' AND indexname = 'idx_grupo_equipos_grupo'
  `);
  console.log('idx_grupo_equipos_grupo:', indexes.length ? 'OK' : 'FALTA');
} catch (error) {
  console.error('Error aplicando migración:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
