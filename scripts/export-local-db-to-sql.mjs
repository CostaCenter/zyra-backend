/**
 * Exporta todos los datos locales a SQL (INSERT) para importar en Railway.
 * node scripts/export-local-db-to-sql.mjs
 */
import fsNode from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import './load-env-for-scripts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../data/local-production-seed.sql');

const local = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'zyra',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
});

function sqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (Buffer.isBuffer(val)) return `'\\\\x${val.toString('hex')}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  await local.connect();
  const { rows: tables } = await local.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `);

  const lines = [
    '-- Zyra local → producción (generado automáticamente)',
    'BEGIN;',
    'SET session_replication_role = replica;',
  ];

  if (tables.length) {
    lines.push(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE;`);
  }

  let total = 0;

  for (const { tablename } of tables) {
    const { rows: cols } = await local.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [tablename],
    );
    if (!cols.length) continue;

    const colNames = cols.map((c) => `"${c.column_name}"`).join(', ');
    const { rows } = await local.query(`SELECT ${colNames} FROM "${tablename}"`);
    if (!rows.length) continue;

    for (const row of rows) {
      const values = cols.map((c) => sqlValue(row[c.column_name])).join(', ');
      lines.push(`INSERT INTO "${tablename}" (${colNames}) VALUES (${values});`);
      total += 1;
    }
    lines.push('');
  }

  lines.push('SET session_replication_role = origin;');
  lines.push('COMMIT;');

  fsNode.mkdirSync(path.dirname(OUT), { recursive: true });
  fsNode.writeFileSync(OUT, lines.join('\n'), 'utf8');

  console.log(`✅ Exportado: ${OUT}`);
  console.log(`   ${tables.length} tablas, ${total} filas`);

  await local.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
