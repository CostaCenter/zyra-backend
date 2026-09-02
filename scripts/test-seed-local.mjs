/**
 * Prueba local del seed sin tocar la BD zyra principal.
 * node scripts/test-seed-local.mjs
 */
import pg from 'pg';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = 'zyra_seed_test';

const admin = new pg.Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '123',
  database: 'postgres',
});

async function main() {
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();

  process.env.DATABASE_URL = `postgresql://postgres:123@localhost:5432/${TEST_DB}`;
  process.env.SEED_PRODUCTION_DATA = 'true';
  process.env.RAILWAY_ENVIRONMENT = 'production';

  execSync('node scripts/run-all-migrations.mjs', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });

  const { seedProductionIfEmpty } = await import('../src/utils/seedProductionIfEmpty.js');
  await seedProductionIfEmpty();

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows: sports } = await client.query('SELECT COUNT(*)::int AS n FROM sports');
  const { rows: users } = await client.query('SELECT COUNT(*)::int AS n FROM "user"');
  console.log('\n🧪 Test seed:', { sports: sports[0].n, users: users[0].n });
  await client.end();

  if (sports[0].n === 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
