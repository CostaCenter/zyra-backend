/**
 * Importa data/local-production-seed.sql en la BD conectada.
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

function parseInsertStatements(sql) {
  return sql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('INSERT INTO '));
}

async function getExistingTables(client) {
  const { rows } = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  return new Set(rows.map((r) => r.tablename));
}

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

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: dbUrl.includes('railway') ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  console.log('📦 Importando seed local → producción...');

  const tables = await getExistingTables(client);
  const inserts = parseInsertStatements(fs.readFileSync(DUMP, 'utf8'));
  const tableFromInsert = /^INSERT INTO "([^"]+)"/;

  try {
    await client.query('BEGIN');
    try {
      await client.query('SET session_replication_role = replica');
    } catch (err) {
      console.warn('⚠️ session_replication_role no disponible:', err.message);
    }

    const truncateList = [...tables].map((t) => `"${t}"`).join(', ');
    if (truncateList) {
      await client.query(`TRUNCATE ${truncateList} RESTART IDENTITY CASCADE`);
    }

    let imported = 0;
    for (const statement of inserts) {
      const match = statement.match(tableFromInsert);
      const table = match?.[1];
      if (!table || !tables.has(table)) continue;
      await client.query(statement);
      imported += 1;
    }

    try {
      await client.query('SET session_replication_role = origin');
    } catch {
      // ignore
    }

    await client.query('COMMIT');
    console.log(`✅ ${imported} inserts aplicados`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
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
