import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  '../src/db/migrations/006_dorsales_equipo_perfil.sql'
);

try {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
  console.log('Migración 006 aplicada correctamente.');

  const [teamCols] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'Team_Miembros' AND column_name = 'dorsal_habitual'
  `);
  const [statsCols] = await sequelize.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'usuario_stats_por_sport' AND column_name = 'dorsal_preferido'
  `);
  const [constraints] = await sequelize.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conname = 'uq_team_dorsal_habitual'
  `);

  console.log('dorsal_habitual:', teamCols.length ? 'OK' : 'FALTA');
  console.log('dorsal_preferido:', statsCols.length ? 'OK' : 'FALTA');
  console.log('uq_team_dorsal_habitual:', constraints.length ? 'OK' : 'FALTA');
} catch (error) {
  console.error('Error aplicando migración:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
