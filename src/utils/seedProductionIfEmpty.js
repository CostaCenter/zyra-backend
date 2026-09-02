import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import sequelize from '../config/database.js';

const DUMP = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/local-production-seed.sql',
);

const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

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

export async function seedProductionIfEmpty() {
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

  const explicitSeed = process.env.SEED_PRODUCTION_DATA === 'true';
  const autoSeedOnRailway = isRailway && fs.existsSync(DUMP);

  if (!explicitSeed && !autoSeedOnRailway) {
    return;
  }

  if (!fs.existsSync(DUMP)) {
    console.warn('⚠️ Producción vacía pero no existe local-production-seed.sql');
    return;
  }

  console.log('📦 Producción vacía — importando seed local...');

  const dbUrl =
    process.env.DATABASE_URL
    || process.env.DATABASE_PRIVATE_URL
    || process.env.POSTGRES_URL
    || null;

  if (!dbUrl) {
    console.error('❌ Seed falló: no hay DATABASE_URL configurada');
    return;
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: dbUrl?.includes('railway') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();

    const tables = await getExistingTables(client);
    const inserts = parseInsertStatements(fs.readFileSync(DUMP, 'utf8'));
    const tableFromInsert = /^INSERT INTO "([^"]+)"/;

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
    let skipped = 0;

    for (const statement of inserts) {
      const match = statement.match(tableFromInsert);
      const table = match?.[1];
      if (!table || !tables.has(table)) {
        skipped += 1;
        continue;
      }
      await client.query(statement);
      imported += 1;
    }

    try {
      await client.query('SET session_replication_role = origin');
    } catch {
      // ignore
    }

    await client.query('COMMIT');

    const { rows: users } = await client.query('SELECT COUNT(*)::int AS n FROM "user"');
    const { rows: sports } = await client.query('SELECT COUNT(*)::int AS n FROM sports');
    const { rows: torneos } = await client.query('SELECT COUNT(*)::int AS n FROM torneos');
    console.log(`✅ Seed OK — inserts: ${imported}, omitidos: ${skipped}`);
    console.log(`   usuarios: ${users[0].n}, deportes: ${sports[0].n}, torneos: ${torneos[0].n}`);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('❌ Seed falló (el servidor sigue arrancando):', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}
