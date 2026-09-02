import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrations = [
  '../src/db/migrations/007_visibilidad_torneo.sql',
  '../src/db/migrations/008_torneo_inscripciones.sql'
];

try {
  for (const relPath of migrations) {
    const migrationPath = path.join(__dirname, relPath);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await sequelize.query(sql);
    console.log(`Migración aplicada: ${path.basename(migrationPath)}`);
  }

  const [visCols] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'torneos'
      AND column_name IN ('visibilidad', 'codigo_acceso')
    ORDER BY column_name
  `);
  console.log('Columnas torneos:', visCols.map((c) => c.column_name).join(', ') || 'FALTA');

  const [tables] = await sequelize.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'torneo_inscripciones'
  `);
  console.log('tabla torneo_inscripciones:', tables.length ? 'OK' : 'FALTA');

  const [indexes] = await sequelize.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'torneo_inscripciones' AND indexname = 'uq_torneo_team_activa'
  `);
  console.log('uq_torneo_team_activa:', indexes.length ? 'OK' : 'FALTA');
} catch (error) {
  console.error('Error aplicando migraciones:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
