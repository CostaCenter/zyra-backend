/**
 * Agrega 15 jugadores únicos a la división del club Victory (Railway/producción).
 *
 * Uso (PowerShell):
 *   $env:TARGET_DATABASE_URL="postgresql://postgres:PASS@HOST.railway.app:PORT/railway"
 *   node scripts/seed-victory-plantel.mjs
 *
 * Opcional:
 *   $env:CLUB_NAME="victo"          # búsqueda ILIKE (default: victo)
 *   $env:JUGADORES_A_AGREGAR="15"    # default: 15
 */
import pg from 'pg';
import './load-env-for-scripts.mjs';

const { Client } = pg;

const TARGET_URL = process.env.TARGET_DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
const CLUB_QUERY = `%${(process.env.CLUB_NAME || 'victo').trim()}%`;
const JUGADORES_A_AGREGAR = Number(process.env.JUGADORES_A_AGREGAR || 15);

const POSICIONES = [
  'ARMADOR', 'PUNTA', 'CENTRAL', 'OPUESTO', 'PUNTA',
  'CENTRAL', 'LÍBERO', 'PUNTA', 'ARMADOR', 'CENTRAL',
  'OPUESTO', 'PUNTA', 'CENTRAL', 'PUNTA', 'CENTRAL',
];

function getClient() {
  if (TARGET_URL) {
    if (TARGET_URL.includes('railway.internal')) {
      throw new Error('Usa la Public URL de Postgres (no railway.internal)');
    }
    return new Client({
      connectionString: TARGET_URL,
      ssl: { rejectUnauthorized: false },
    });
  }

  return new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'zyra',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '123',
  });
}

async function query(client, sql, params = []) {
  const { rows } = await client.query(sql, params);
  return rows;
}

async function main() {
  const client = getClient();
  await client.connect();

  try {
    await run(client);
  } finally {
    await client.end();
  }
}

async function run(client) {

  const dbInfo = TARGET_URL
    ? new URL(TARGET_URL).hostname
    : `${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'zyra'}`;
  console.log(`DB: ${dbInfo}\n`);

  const clubs = await query(
    client,
    `SELECT id, nombre, admin_id FROM clubs WHERE nombre ILIKE $1 ORDER BY id`,
    [CLUB_QUERY],
  );
  const club = clubs[0];
  if (!club) {
    const all = await query(client, `SELECT id, nombre FROM clubs ORDER BY id`);
    console.log('Clubs en BD:', all);
    throw new Error(`Club "${CLUB_QUERY}" no encontrado`);
  }
  if (clubs.length > 1) {
    console.log('Varios clubs coinciden:', clubs.map((c) => `${c.id}: ${c.nombre}`));
    console.log(`Usando: ${club.nombre} (id=${club.id})\n`);
  }

  const divisions = await query(
    client,
    `SELECT id, nombre, genero FROM club_divisiones WHERE club_id = $1 ORDER BY id`,
    [club.id],
  );
  if (!divisions.length) throw new Error('El club no tiene divisiones');

  const division = divisions[0];
  if (divisions.length > 1) {
    console.log('Divisiones:', divisions.map((d) => `${d.id}: ${d.nombre}`));
    console.log(`Usando división: ${division.nombre} (id=${division.id})\n`);
  }

  const existingAtletas = await query(
    client,
    `SELECT cda.usuario_id, u.nick, u.name, cda.dorsal
     FROM club_division_atletas cda
     JOIN "user" u ON u.id = cda.usuario_id
     WHERE cda.club_division_id = $1
     ORDER BY cda.dorsal NULLS LAST, cda.id`,
    [division.id],
  );

  const assignedInDivision = new Set(existingAtletas.map((a) => a.usuario_id));
  assignedInDivision.add(club.admin_id);

  const allUsers = await query(client, `SELECT id, nick, name FROM "user" ORDER BY id`);
  const userPool = allUsers.filter((u) => !assignedInDivision.has(u.id));

  if (userPool.length < JUGADORES_A_AGREGAR) {
    throw new Error(
      `Solo hay ${userPool.length} usuarios disponibles (se necesitan ${JUGADORES_A_AGREGAR})`,
    );
  }

  const picked = userPool.slice(0, JUGADORES_A_AGREGAR);
  const dorsalesUsados = new Set(
    existingAtletas.map((a) => a.dorsal).filter((d) => d != null),
  );
  let nextDorsal = 1;
  const getNextDorsal = () => {
    while (dorsalesUsados.has(nextDorsal)) nextDorsal += 1;
    const d = nextDorsal;
    dorsalesUsados.add(d);
    nextDorsal += 1;
    return d;
  };

  const inserted = [];

  try {
    await client.query('BEGIN');

    for (let i = 0; i < picked.length; i += 1) {
      const user = picked[i];
      const dorsal = getNextDorsal();
      const posicion = POSICIONES[i % POSICIONES.length];

      await client.query(
        `INSERT INTO club_division_atletas
           (club_division_id, usuario_id, dorsal, posicion, estado, fecha_ingreso)
         VALUES ($1, $2, $3, $4, 'ACTIVO', NOW())`,
        [division.id, user.id, dorsal, posicion],
      );

      await client.query(
        `INSERT INTO club_miembros (club_id, usuario_id, rol_membresia, estado, fecha_ingreso)
         VALUES ($1, $2, 'MIEMBRO', 'ACTIVO', NOW())
         ON CONFLICT (club_id, usuario_id) DO NOTHING`,
        [club.id, user.id],
      );

      inserted.push({
        usuario_id: user.id,
        nick: user.nick,
        name: user.name,
        dorsal,
        posicion,
      });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  console.log(`\n✅ ${inserted.length} jugadores agregados a "${club.nombre}" → ${division.nombre}\n`);
  console.table(inserted);

  const [verify] = await query(
    client,
    `SELECT COUNT(*)::int AS total FROM club_division_atletas WHERE club_division_id = $1`,
    [division.id],
  );
  console.log(`Total jugadores en división: ${verify.total}`);

  const dupes = await query(
    client,
    `SELECT usuario_id, COUNT(*)::int AS veces
     FROM club_division_atletas
     WHERE club_division_id = $1
     GROUP BY usuario_id
     HAVING COUNT(*) > 1`,
    [division.id],
  );
  if (dupes.length) {
    console.error('⚠️ Duplicados detectados:', dupes);
  } else {
    console.log('✓ Ningún jugador repetido en la división');
  }
}

main()
  .catch((err) => {
    console.error(err.message || err);
    if (!TARGET_URL) {
      console.error('\nTip: para Railway usa TARGET_DATABASE_URL (Public URL de Postgres).');
    }
    process.exit(1);
  });
