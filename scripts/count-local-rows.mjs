import pg from 'pg';
import './load-env-for-scripts.mjs';

const c = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'zyra',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
});

await c.connect();
const tables = await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
let total = 0;
for (const { tablename } of tables.rows) {
  const n = await c.query(`SELECT COUNT(*)::int AS n FROM "${tablename}"`);
  if (n.rows[0].n > 0) {
    console.log(tablename.padEnd(40), n.rows[0].n);
    total += n.rows[0].n;
  }
}
console.log('---');
console.log('Total filas (aprox):', total);
await c.end();
