import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from '../db/db.js';

const DUMP = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/local-production-seed.sql',
);

export async function seedProductionIfEmpty() {
  if (process.env.SEED_PRODUCTION_DATA !== 'true') {
    return;
  }

  let existing = 0;
  try {
    const [rows] = await sequelize.query('SELECT COUNT(*)::int AS n FROM sports');
    existing = rows[0]?.n ?? 0;
  } catch {
    existing = 0;
  }

  if (existing > 0) {
    console.log('⏭ Seed omitido: producción ya tiene datos.');
    return;
  }

  if (!fs.existsSync(DUMP)) {
    console.warn('⚠️ SEED_PRODUCTION_DATA=true pero no existe local-production-seed.sql');
    return;
  }

  console.log('📦 Producción vacía — importando seed local (3128 filas)...');
  const sql = fs.readFileSync(DUMP, 'utf8');
  await sequelize.query(sql);

  const [users] = await sequelize.query('SELECT COUNT(*)::int AS n FROM "user"');
  const [sports] = await sequelize.query('SELECT COUNT(*)::int AS n FROM sports');
  const [torneos] = await sequelize.query('SELECT COUNT(*)::int AS n FROM torneos');
  console.log(`✅ Seed OK — usuarios: ${users[0].n}, deportes: ${sports[0].n}, torneos: ${torneos[0].n}`);
}
