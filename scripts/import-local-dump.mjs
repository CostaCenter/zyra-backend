/**
 * Importa data/local-production-seed.sql en la BD conectada.
 *
 * Railway (internal URL OK):
 *   SEED_PRODUCTION_DATA=true + DATABASE_URL inyectada → preDeploy automático
 *
 * Desde tu PC (Public URL):
 *   $env:TARGET_DATABASE_URL="postgresql://...@HOST.railway.app:PORT/railway"
 *   node scripts/import-local-dump.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import '../src/config/loadEnv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUMP = path.join(__dirname, '../data/local-production-seed.sql');

async function main() {
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  const dbUrl = targetUrl || process.env.DATABASE_URL;
  const fromLocal = Boolean(targetUrl);
  const fromRailway = process.env.SEED_PRODUCTION_DATA === 'true';

  if (!fromLocal && !fromRailway) {
    console.log('⏭  Import omitido (SEED_PRODUCTION_DATA≠true y sin TARGET_DATABASE_URL).');
    return;
  }

  if (!fs.existsSync(DUMP)) {
    console.error('❌ No existe', DUMP);
    process.exit(1);
  }

  if (!dbUrl) {
    console.error('❌ Falta DATABASE_URL o TARGET_DATABASE_URL');
    process.exit(1);
  }

  if (dbUrl.includes('railway.internal') && fromLocal) {
    console.error('❌ Desde tu PC usa la Public URL de Postgres, no railway.internal');
    process.exit(1);
  }

  const sql = fs.readFileSync(DUMP, 'utf8');
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('railway') ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  console.log('📦 Importando seed local → producción...');
  await client.query(sql);
  console.log('✅ Seed importado (~3128 filas).');
  await client.end();
}

main().catch((err) => {
  console.error('❌ Import falló:', err.message);
  process.exit(1);
});
