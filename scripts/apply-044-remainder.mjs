import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONSTRAINTS = [
  {
    table: 'club_metrica_evaluacion',
    name: 'uq_metrica_sport_nombre',
    sql: 'UNIQUE (sport_id, nombre_metrica)',
  },
  {
    table: 'club_evento_asistencias',
    name: 'uq_evento_usuario_asistencia',
    sql: 'UNIQUE (evento_id, usuario_id)',
  },
  {
    table: 'club_evento_evaluacion',
    name: 'uq_evento_usuario_evaluador',
    sql: 'UNIQUE (evento_id, usuario_id, evaluador_id)',
  },
  {
    table: 'club_evento_evaluacion_detalle',
    name: 'uq_evaluacion_metrica',
    sql: 'UNIQUE (evaluacion_id, metrica_id)',
  },
];

async function ensureConstraints() {
  for (const c of CONSTRAINTS) {
    await sequelize.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${c.table}')
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${c.name}') THEN
          ALTER TABLE ${c.table} ADD CONSTRAINT ${c.name} ${c.sql};
        END IF;
      END $$;
    `);
    console.log(`✓ ${c.name}`);
  }
}

async function main() {
  await ensureConstraints();

  const sqlPath = path.join(__dirname, '../src/db/migrations/044_club_gestion.sql');
  const full = fs.readFileSync(sqlPath, 'utf8');
  const fromBackfill = full.split('-- Backfill admin como miembro ADMIN')[1];

  const chunks = fromBackfill
    .split(/(?=-- )/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    try {
      await sequelize.query(chunk);
      console.log('✓', chunk.split('\n')[0].slice(0, 70));
    } catch (error) {
      console.error('✗', chunk.split('\n')[0]);
      console.error(' ', error.parent?.message || error.message);
      throw error;
    }
  }
}

try {
  await main();
  console.log('\n✅ 044 remainder completado');
} catch {
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
