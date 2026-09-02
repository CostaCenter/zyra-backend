/**
 * Copia todos los datos de PostgreSQL local → Railway (producción).
 *
 * Uso (PowerShell):
 *   $env:TARGET_DATABASE_URL="postgresql://postgres:PASS@HOST.railway.app:PORT/railway"
 *   node scripts/copy-local-db-to-railway.mjs
 *
 * TARGET_DATABASE_URL = Public URL de Railway → Postgres → Connect (NO *.railway.internal)
 */
import pg from 'pg';
import './load-env-for-scripts.mjs';

const LOCAL = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'zyra',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
};

const TARGET_URL = process.env.TARGET_DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

if (!TARGET_URL) {
  console.error('❌ Falta TARGET_DATABASE_URL (Public URL de Postgres en Railway).');
  console.error('   Railway → Postgres → Connect → Public Network → copia DATABASE_URL');
  process.exit(1);
}

if (TARGET_URL.includes('railway.internal')) {
  console.error('❌ Usa la Public URL, no railway.internal (solo funciona dentro de Railway).');
  process.exit(1);
}

const local = new pg.Client(LOCAL);
const remote = new pg.Client({
  connectionString: TARGET_URL,
  ssl: { rejectUnauthorized: false },
});

async function getTables(client) {
  const { rows } = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return rows.map((r) => r.tablename);
}

async function getColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return rows.map((r) => r.column_name);
}

async function copyTable(table) {
  const localCols = await getColumns(local, table);
  const remoteCols = await getColumns(remote, table);

  if (!localCols.length || !remoteCols.length) {
    console.log(`  ⏭ ${table} (sin columnas en algún lado)`);
    return 0;
  }

  const cols = localCols.filter((c) => remoteCols.includes(c));
  if (!cols.length) {
    console.log(`  ⏭ ${table} (sin columnas en común)`);
    return 0;
  }

  const quoted = cols.map((c) => `"${c}"`).join(', ');
  const { rows } = await local.query(`SELECT ${quoted} FROM "${table}"`);
  if (!rows.length) {
    console.log(`  · ${table} (0 filas)`);
    return 0;
  }

  const colIndexes = cols.map((_, i) => `$${i + 1}`).join(', ');
  const batchSize = 200;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    for (const row of batch) {
      const values = cols.map((c) => row[c]);
      await remote.query(
        `INSERT INTO "${table}" (${quoted}) VALUES (${colIndexes}) ON CONFLICT DO NOTHING`,
        values,
      );
    }
  }

  console.log(`  ✓ ${table} (${rows.length} filas)`);
  return rows.length;
}

async function resetSequences() {
  const { rows } = await remote.query(`
    SELECT c.relname AS table_name, a.attname AS column_name,
           pg_get_serial_sequence(format('%I.%I', 'public', c.relname), a.attname) AS seq
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE c.relkind = 'r'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND pg_get_serial_sequence(format('%I.%I', 'public', c.relname), a.attname) IS NOT NULL
  `);

  for (const { table_name, column_name, seq } of rows) {
    if (!seq) continue;
    await remote.query(`
      SELECT setval('${seq}', COALESCE((SELECT MAX("${column_name}") FROM "${table_name}"), 1), true)
    `);
  }
}

async function main() {
  console.log('🔗 Local:', `${LOCAL.host}:${LOCAL.port}/${LOCAL.database}`);
  console.log('🔗 Remoto: Railway (public)\n');

  await local.connect();
  await remote.connect();

  const tables = await getTables(local);
  console.log(`📋 ${tables.length} tablas en local\n`);

  console.log('🗑  Limpiando datos en producción (TRUNCATE CASCADE)...');
  await remote.query('SET session_replication_role = replica');
  if (tables.length) {
    const list = tables.map((t) => `"${t}"`).join(', ');
    await remote.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  }

  console.log('📦 Copiando datos...\n');
  let total = 0;
  for (const table of tables) {
    try {
      total += await copyTable(table);
    } catch (err) {
      console.error(`  ✗ ${table}: ${err.message}`);
    }
  }

  console.log('\n🔢 Reseteando secuencias...');
  await resetSequences();
  await remote.query('SET session_replication_role = origin');

  console.log(`\n✅ Listo. ${total} filas copiadas a producción.`);

  await local.end();
  await remote.end();
}

main().catch((err) => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
