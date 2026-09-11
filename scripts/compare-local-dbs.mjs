import pg from 'pg';

for (const db of ['zyra', 'zyra_seed_test']) {
  const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '123',
    database: db,
  });
  try {
    await client.connect();
    const { rows: users } = await client.query('SELECT COUNT(*)::int AS n FROM "user"');
    const { rows: teams } = await client.query('SELECT COUNT(*)::int AS n FROM "Team"');
    const { rows: sports } = await client.query('SELECT COUNT(*)::int AS n FROM sports');
    console.log(db, { users: users[0].n, teams: teams[0].n, sports: sports[0].n });
  } catch (e) {
    console.log(db, 'ERROR', e.message);
  } finally {
    await client.end().catch(() => {});
  }
}
