/**
 * Importa data/local-production-seed.sql en la BD conectada.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import '../src/config/loadEnv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUMP = path.join(__dirname, '../data/local-production-seed.sql');

async function verifyCounts(client) {
  const checks = [
    ['user', 'usuarios'],
    ['sports', 'deportes'],
    ['torneos', 'torneos'],
    ['publicaciones', 'publicaciones'],
    ['partidos', 'partidos'],
  ];

  console.log('\n📊 Verificación post-import:');
  for (const [table, label] of checks) {
    try {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
      console.log(`   ${label}: ${rows[0].n}`);
    } catch {
      console.log(`   ${label}: (tabla no existe)`);
    }
  }
}

async function main() {
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  const dbUrl = targetUrl || process.env.DATABASE_URL;
  const fromLocal = Boolean(targetUrl);
  const shouldImport = fromLocal || process.env.SEED_PRODUCTION_DATA === 'true';

  if (!shouldImport) {
    console.log('⏭  Import omitido (SEED_PRODUCTION_DATA≠true).');
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

  try {
    await client.query(sql);
  } catch (err) {
    console.error('❌ Error SQL durante import:', err.message);
    process.exit(1);
  }

  await verifyCounts(client);
  console.log('\n✅ Seed importado correctamente.');
  await client.end();
}

main().catch((err) => {
  console.error('❌ Import falló:', err.message);
  process.exit(1);
});
