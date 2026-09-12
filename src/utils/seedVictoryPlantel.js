import sequelize from '../config/database.js';

const CLUB_QUERY = '%victo%';
const JUGADORES_OBJETIVO = 15;

const POSICIONES = [
  'ARMADOR', 'PUNTA', 'CENTRAL', 'OPUESTO', 'PUNTA',
  'CENTRAL', 'LÍBERO', 'PUNTA', 'ARMADOR', 'CENTRAL',
  'OPUESTO', 'PUNTA', 'CENTRAL', 'PUNTA', 'CENTRAL',
];

function shouldRunVictorySeed() {
  if (process.env.SEED_VICTORY_PLANTEL === 'true') return true;
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return true;

  const dbUrl = String(
    process.env.DATABASE_URL
    || process.env.DATABASE_PRIVATE_URL
    || process.env.POSTGRES_URL
    || '',
  );
  if (/railway\.(internal|app)|rlwy\.net|proxy\.rlwy/i.test(dbUrl)) return true;

  const host = (process.env.DB_HOST || '').trim().toLowerCase();
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && host !== '';
}

export async function seedVictoryPlantelIfNeeded() {
  if (!shouldRunVictorySeed()) {
    console.log('⏭ Seed Victory omitido: entorno local');
    return;
  }

  const [clubRows] = await sequelize.query(
    `SELECT id, nombre, admin_id FROM clubs WHERE nombre ILIKE :q ORDER BY id`,
    { replacements: { q: CLUB_QUERY } },
  );
  const club = clubRows[0];
  if (!club) {
    console.log('⏭ Seed Victory omitido: club no encontrado');
    return;
  }

  const [divisions] = await sequelize.query(
    `SELECT id, nombre FROM club_divisiones WHERE club_id = :clubId ORDER BY id`,
    { replacements: { clubId: club.id } },
  );
  const division = divisions[0];
  if (!division) {
    console.log('⏭ Seed Victory omitido: sin divisiones');
    return;
  }

  const [existingAtletas] = await sequelize.query(
    `SELECT usuario_id, dorsal FROM club_division_atletas WHERE club_division_id = :divisionId`,
    { replacements: { divisionId: division.id } },
  );

  if (existingAtletas.length >= JUGADORES_OBJETIVO) {
    console.log(`⏭ Seed Victory omitido: ${club.nombre} ya tiene ${existingAtletas.length} jugadores`);
    return;
  }

  const needed = JUGADORES_OBJETIVO - existingAtletas.length;
  const assignedInDivision = new Set(existingAtletas.map((a) => a.usuario_id));
  assignedInDivision.add(club.admin_id);

  const [allUsers] = await sequelize.query(`SELECT id, nick, name FROM "user" ORDER BY id`);
  const userPool = allUsers.filter((u) => !assignedInDivision.has(u.id));

  if (userPool.length < needed) {
    console.warn(`⚠️ Seed Victory: solo ${userPool.length} usuarios disponibles (se necesitan ${needed})`);
    return;
  }

  const picked = userPool.slice(0, needed);
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

  await sequelize.transaction(async (transaction) => {
    for (let i = 0; i < picked.length; i += 1) {
      const user = picked[i];
      const dorsal = getNextDorsal();
      const posicion = POSICIONES[i % POSICIONES.length];

      await sequelize.query(
        `INSERT INTO club_division_atletas
           (club_division_id, usuario_id, dorsal, posicion, estado, fecha_ingreso)
         VALUES (:divisionId, :usuarioId, :dorsal, :posicion, 'ACTIVO', NOW())`,
        {
          replacements: {
            divisionId: division.id,
            usuarioId: user.id,
            dorsal,
            posicion,
          },
          transaction,
        },
      );

      await sequelize.query(
        `INSERT INTO club_miembros (club_id, usuario_id, rol_membresia, estado, fecha_ingreso)
         VALUES (:clubId, :usuarioId, 'MIEMBRO', 'ACTIVO', NOW())
         ON CONFLICT (club_id, usuario_id) DO NOTHING`,
        { replacements: { clubId: club.id, usuarioId: user.id }, transaction },
      );
    }
  });

  console.log(`✅ Seed Victory: ${picked.length} jugadores agregados a "${club.nombre}" → ${division.nombre}`);
  console.log(`   Jugadores: ${picked.map((u) => u.nick || u.name).join(', ')}`);
}
