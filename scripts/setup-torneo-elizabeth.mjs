/**
 * Torneo "Elizabeth" (id=20): inscribe 14 equipos, plantillas únicas,
 * y corrige KABO para que no comparta jugadores con Apex (salvo Kevin y Andrés).
 *
 * Ejecutar: node scripts/setup-torneo-elizabeth.mjs
 */
import bcrypt from 'bcryptjs';
import sequelize from '../src/config/database.js';
import { Torneos, TorneoInscripcion, Team, DataTeam } from '../src/db/db.js';

const TORNEO_ID = 20;
const ORGANIZADOR_ID = 14; // Kevin
const ANDRES_ID = 1;
const KEVIN_ID = 14;
const APEX_ID = 40;
const KABO_ID = 12;

const POS_VOLEY = ['ARMADOR', 'CENTRAL', 'PUNTA', 'OPUESTO', 'LÍBERO'];
const MANOS = ['DERECHA', 'IZQUIERDA'];

const EXISTING_TEAM_IDS = [
  KABO_ID,
  13, // Andres Team FC
  14, // Elementales Group
  36, // SEED_Voleibol Andes
  37, // SEED_Vóley Altura
  38, // SEED_Smash Norte
  39, // SEED_Red Volcán
  41, // Andrés club
];

const NEW_TEAM_NAMES = [
  'Elizabeth Volley Stars',
  'Club Arena Dorada',
  'Equipo Relámpago',
  'Vóley Pacífico',
  'Unidos del Sur',
  'Titanes de Red',
];

const EXTRA_USER_NAMES = [
  'Alejandro Meza', 'Beatriz Naranjo', 'César Villalobos', 'Diana Molina',
  'Emilio Cárdenas', 'Florencia Rojas', 'Germán Acosta', 'Helena Duque',
  'Ignacio Pérez', 'Jimena Castro', 'Karim Londoño', 'Leticia Guzmán',
  'Manuel Sierra', 'Nora Ibáñez', 'Octavio Rentería', 'Paola Mendoza',
  'Quintín Barrios', 'Renata Osorio', 'Samuel Aguirre', 'Tatiana Vélez',
  'Ulises Camacho', 'Valeria Espinosa', 'Walter Girón', 'Ximena Paredes',
  'Yolanda Cruz', 'Zacarías Luna', 'Adelaida Mora', 'Benjamín Ortiz',
  'Celeste Rivas', 'Domingo Salinas', 'Elisa Tamayo', 'Fabricio Uribe',
  'Griselda Valencia', 'Héctor Zamora', 'Ingrid Ávila', 'Joaquín Bustos',
  'Kelly Montenegro', 'Leandro Pacheco', 'Magdalena Quiroz', 'Nelson Rosero',
  'Olga Santamaría', 'Pablo Tobón', 'Raquel Umaña', 'Santiago Velásquez',
  'Teresa Zuluaga', 'Ubaldo Marín', 'Violeta Ocampo', 'Wilfredo Palma',
  'Xenia Quintero', 'Yahir Restrepo', 'Zulema Soto', 'Alonso Tovar',
  'Brenda Usma', 'Camilo Vargas', 'Dora Wills', 'Efraín Yepes',
  'Fabiola Zárate', 'Gonzalo Abadía', 'Hilda Bermúdez', 'Iván Caicedo',
  'Jackeline Díaz', 'Kelvin Estupiñán', 'Luzmila Fajardo', 'Mario Galvis',
  'Nancy Herrera', 'Omar Insuasty', 'Pilar Jaramillo', 'Ramiro Klinger',
  'Silvia Lasso', 'Tomás Murcia', 'Úrsula Nieto', 'Víctor Ochoa',
  'Wendy Parra', 'Xavier Quevedo', 'Yolanda Ruiz', 'Zenón Salazar',
  'Amalia Trujillo', 'Bruno Uribe', 'Cecilia Vásquez', 'Darío Zapata',
  'Estela Arias', 'Francisco Bolaños', 'Gabriela Cifuentes',
];

async function ensureExtraUsers(transaction) {
  const passwordHash = await bcrypt.hash('SeedZyra2026!', 10);
  const [sportRows] = await sequelize.query(
    `SELECT id FROM sports WHERE name ILIKE '%v%ley%' OR name ILIKE '%volleyball%' LIMIT 1`,
    { transaction },
  );
  const voleyId = sportRows[0]?.id ?? 2;

  const ids = [];
  for (let i = 0; i < EXTRA_USER_NAMES.length; i += 1) {
    const num = String(i + 1).padStart(2, '0');
    const nick = `SEED_Eliz_${num}`;
    const name = EXTRA_USER_NAMES[i];

    const [existing] = await sequelize.query(
      `SELECT id FROM "user" WHERE nick = :nick LIMIT 1`,
      { replacements: { nick }, transaction },
    );

    if (existing[0]) {
      ids.push(existing[0].id);
      continue;
    }

    const [inserted] = await sequelize.query(
      `INSERT INTO "user" (name, nick, email, telefono, password_hash, role, status, deporte_principal_id, es_dato_prueba, creado_at)
       VALUES (:name, :nick, :email, :telefono, :passwordHash, 'JUGADOR', 'ACTIVO', :voleyId, true, NOW())
       RETURNING id`,
      {
        replacements: {
          name,
          nick,
          email: `${nick}@zyra-test.local`,
          telefono: `301${num.padStart(7, '0')}`,
          passwordHash,
          voleyId,
        },
        transaction,
      },
    );

    const userId = inserted[0].id;
    await sequelize.query(
      `INSERT INTO usuario_stats_por_sport
        (user_id, sport_id, elo_oficial, goles_oficiales, partidos_oficiales, elo_casual, goles_casuales, partidos_casuales, posicion_principal, mano_habil, dorsal_preferido)
       SELECT :userId, :voleyId, 15.0, 0, 0, 14.0, 0, 0, 'PUNTA', 'DERECHA', :dorsal
       WHERE NOT EXISTS (
         SELECT 1 FROM usuario_stats_por_sport WHERE user_id = :userId AND sport_id = :voleyId
       )`,
      { replacements: { userId, voleyId, dorsal: (i % 99) + 1 }, transaction },
    );

    ids.push(userId);
  }

  return ids;
}

function buildPlantillaEntries(userIds, capitanId, dorsalBase = 1) {
  return userIds.map((userId, index) => {
    const posicion = POS_VOLEY[index % POS_VOLEY.length];
    return {
      user_id: userId,
      rol: userId === capitanId ? 'CAPITAN' : 'JUGADOR',
      dorsal: dorsalBase + index,
      posicion,
      mano: MANOS[index % MANOS.length],
      es_libero: posicion === 'LÍBERO',
    };
  });
}

async function upsertMiembro(transaction, teamId, jugador) {
  const [rows] = await sequelize.query(
    `SELECT id FROM "Team_Miembros" WHERE team_id = :teamId AND user_id = :userId`,
    { replacements: { teamId, userId: jugador.user_id }, transaction },
  );

  if (rows[0]) {
    await sequelize.query(
      `UPDATE "Team_Miembros"
       SET rol = :rol, estado_invitacion = 'ACEPTADO', fecha_union = COALESCE(fecha_union, NOW()),
           dorsal_habitual = :dorsal
       WHERE id = :id`,
      { replacements: { rol: jugador.rol, dorsal: jugador.dorsal, id: rows[0].id }, transaction },
    );
    return;
  }

  await sequelize.query(
    `UPDATE "Team_Miembros"
     SET dorsal_habitual = NULL
     WHERE team_id = :teamId AND dorsal_habitual = :dorsal AND user_id != :userId`,
    { replacements: { teamId, dorsal: jugador.dorsal, userId: jugador.user_id }, transaction },
  );

  await sequelize.query(
    `INSERT INTO "Team_Miembros" (team_id, user_id, rol, estado_invitacion, fecha_union, dorsal_habitual)
     VALUES (:teamId, :userId, :rol, 'ACEPTADO', NOW(), :dorsal)`,
    {
      replacements: {
        teamId,
        userId: jugador.user_id,
        rol: jugador.rol,
        dorsal: jugador.dorsal,
      },
      transaction,
    },
  );
}

async function removeMiembro(transaction, teamId, userId) {
  await sequelize.query(
    `DELETE FROM "Team_Miembros" WHERE team_id = :teamId AND user_id = :userId`,
    { replacements: { teamId, userId }, transaction },
  );
  await sequelize.query(
    `DELETE FROM torneo_plantilla WHERE torneo_id = :torneoId AND team_id = :teamId AND user_id = :userId`,
    { replacements: { torneoId: TORNEO_ID, teamId, userId }, transaction },
  );
}

async function upsertPlantilla(transaction, teamId, jugador) {
  const [rows] = await sequelize.query(
    `SELECT id FROM torneo_plantilla
     WHERE torneo_id = :torneoId AND team_id = :teamId AND user_id = :userId`,
    {
      replacements: { torneoId: TORNEO_ID, teamId, userId: jugador.user_id },
      transaction,
    },
  );

  const payload = {
    dorsal: jugador.dorsal,
    posicion: jugador.posicion,
    mano: jugador.mano,
    esLibero: Boolean(jugador.es_libero),
  };

  if (rows[0]) {
    await sequelize.query(
      `UPDATE torneo_plantilla
       SET dorsal_torneo = :dorsal, posicion_torneo = :posicion, mano_habil_torneo = :mano,
           es_libero = :esLibero, actualizado_at = NOW()
       WHERE id = :id`,
      { replacements: { ...payload, id: rows[0].id }, transaction },
    );
    return;
  }

  await sequelize.query(
    `INSERT INTO torneo_plantilla
      (torneo_id, team_id, user_id, dorsal_torneo, posicion_torneo, mano_habil_torneo, es_libero, creado_at, actualizado_at)
     VALUES (:torneoId, :teamId, :userId, :dorsal, :posicion, :mano, :esLibero, NOW(), NOW())`,
    {
      replacements: {
        torneoId: TORNEO_ID,
        teamId,
        userId: jugador.user_id,
        ...payload,
      },
      transaction,
    },
  );
}

async function syncEquipo(transaction, teamId, capitanId, plantilla, removeUserIds = []) {
  await sequelize.query(
    `UPDATE "Team" SET capitan_id = :capitanId WHERE id = :teamId`,
    { replacements: { capitanId, teamId }, transaction },
  );

  const keepIds = new Set(plantilla.map((j) => j.user_id));

  for (const userId of removeUserIds) {
    await removeMiembro(transaction, teamId, userId);
    keepIds.delete(userId);
  }

  const [actuales] = await sequelize.query(
    `SELECT user_id FROM "Team_Miembros" WHERE team_id = :teamId`,
    { replacements: { teamId }, transaction },
  );

  for (const row of actuales) {
    if (!keepIds.has(row.user_id)) {
      await removeMiembro(transaction, teamId, row.user_id);
    }
  }

  for (const jugador of plantilla) {
    await upsertMiembro(transaction, teamId, jugador);
    await upsertPlantilla(transaction, teamId, jugador);
  }
}

async function inscribirEquipo(transaction, teamId) {
  const existente = await TorneoInscripcion.findOne({
    where: { torneo_id: TORNEO_ID, team_id: teamId },
    transaction,
  });

  if (existente) {
    await existente.update({
      estado: 'ACEPTADA',
      resuelto_por_id: ORGANIZADOR_ID,
      resuelto_at: new Date(),
    }, { transaction });
    return 'actualizada';
  }

  await TorneoInscripcion.create({
    torneo_id: TORNEO_ID,
    team_id: teamId,
    origen: 'INVITACION_TORNEO',
    iniciado_por_id: ORGANIZADOR_ID,
    estado: 'ACEPTADA',
    resuelto_por_id: ORGANIZADOR_ID,
    resuelto_at: new Date(),
  }, { transaction });

  return 'creada';
}

async function crearEquipo(transaction, name, sportId, capitanId) {
  const existente = await Team.findOne({ where: { name }, transaction });
  if (existente) return existente;

  const equipo = await Team.create({
    name,
    sport_id: sportId,
    capitan_id: capitanId,
    privado: false,
    es_dato_prueba: true,
    creado_at: new Date(),
  }, { transaction });

  await DataTeam.create({
    team_id: equipo.id,
    elo: 120,
    games: 10,
    win: 5,
    lose: 5,
    draw: 0,
    total: 10,
  }, { transaction });

  return equipo;
}

try {
  console.log('=== setup-torneo-elizabeth ===\n');

  const torneo = await Torneos.findByPk(TORNEO_ID);
  if (!torneo || torneo.nombre !== 'Elizabeth') {
    throw new Error(`Torneo id=${TORNEO_ID} no encontrado o no es "Elizabeth"`);
  }

  console.log(`Torneo: ${torneo.nombre} (id=${torneo.id}) · max_equipos=${torneo.max_equipos}`);

  const resultados = await sequelize.transaction(async (transaction) => {
    const extraUserIds = await ensureExtraUsers(transaction);
    const seedPool = [];
    for (let i = 135; i <= 174; i += 1) seedPool.push(i);
    const usedUserIds = new Set([
      ANDRES_ID, KEVIN_ID, 8, 11,
      136, 137, 138, 139, 140, 141, 142,
      143, 144, 145, 146,
    ]);

    const allPool = [...seedPool, ...extraUserIds].filter((id) => !usedUserIds.has(id));

    let cursor = 0;
    const take = (count) => {
      const slice = allPool.slice(cursor, cursor + count);
      cursor += count;
      if (slice.length < count) {
        throw new Error(`Pool de jugadores insuficiente (faltan ${count - slice.length})`);
      }
      slice.forEach((id) => usedUserIds.add(id));
      return slice;
    };

    const configs = [];

    // Apex — conservar plantilla actual + Kevin en plantel
    configs.push({
      teamId: APEX_ID,
      capitanId: ANDRES_ID,
      remove: [],
      plantilla: buildPlantillaEntries(
        [ANDRES_ID, KEVIN_ID, 136, 137, 138, 139, 140, 141, 142],
        ANDRES_ID,
        1,
      ),
    });

    // KABO — solo comparte Andrés y Kevin con Apex
    configs.push({
      teamId: KABO_ID,
      capitanId: KEVIN_ID,
      remove: [9, 10, 135, 136, 137],
      plantilla: buildPlantillaEntries(
        [KEVIN_ID, ANDRES_ID, 8, 11, 143, 144, 145, 146],
        KEVIN_ID,
        1,
      ),
    });

    const existingAssignments = [
      { teamId: 13, capitanFromBlock: true },
      { teamId: 14, capitanFromBlock: true },
      { teamId: 36, capitanFromBlock: true },
      { teamId: 37, capitanFromBlock: true },
      { teamId: 38, capitanFromBlock: true },
      { teamId: 39, capitanFromBlock: true },
      { teamId: 41, capitanFromBlock: true },
    ];

    for (const item of existingAssignments) {
      const players = take(8);
      const capitanId = players[0];
      configs.push({
        teamId: item.teamId,
        capitanId,
        remove: [],
        plantilla: buildPlantillaEntries(players, capitanId, 1),
      });
    }

    const newTeams = [];
    for (const name of NEW_TEAM_NAMES) {
      const players = take(8);
      const capitanId = players[0];
      const equipo = await crearEquipo(transaction, name, torneo.sport_id, capitanId);
      newTeams.push(equipo);
      configs.push({
        teamId: equipo.id,
        capitanId,
        remove: [],
        plantilla: buildPlantillaEntries(players, capitanId, 1),
      });
    }

    const inscripciones = [];

    for (const cfg of configs) {
      await syncEquipo(transaction, cfg.teamId, cfg.capitanId, cfg.plantilla, cfg.remove ?? []);
      const accion = await inscribirEquipo(transaction, cfg.teamId);
      inscripciones.push({ teamId: cfg.teamId, accion });
    }

    // Apex ya estaba inscrito — asegurar
    await inscribirEquipo(transaction, APEX_ID);

    return { configs, inscripciones, newTeams };
  });

  console.log('\nEquipos nuevos creados:');
  for (const t of resultados.newTeams) {
    console.log(`  + ${t.name} (id=${t.id})`);
  }

  console.log('\nInscripciones procesadas:');
  for (const row of resultados.inscripciones) {
    const [team] = await sequelize.query(`SELECT name FROM "Team" WHERE id = ${row.teamId}`);
    console.log(`  ✓ ${team[0].name} (id=${row.teamId}) — ${row.accion}`);
  }

  const [resumen] = await sequelize.query(`
    SELECT t.id, t.name, COUNT(tp.id)::int AS jugadores_plantilla
    FROM torneo_inscripciones ti
    JOIN "Team" t ON t.id = ti.team_id
    LEFT JOIN torneo_plantilla tp ON tp.torneo_id = ti.torneo_id AND tp.team_id = t.id
    WHERE ti.torneo_id = ${TORNEO_ID} AND ti.estado = 'ACEPTADA'
    GROUP BY t.id, t.name
    ORDER BY t.name
  `);

  console.log('\nResumen torneo Elizabeth:');
  console.table(resumen);

  const [solapamiento] = await sequelize.query(`
    WITH kabo AS (
      SELECT user_id FROM torneo_plantilla WHERE torneo_id = ${TORNEO_ID} AND team_id = ${KABO_ID}
    ),
    apex AS (
      SELECT user_id FROM torneo_plantilla WHERE torneo_id = ${TORNEO_ID} AND team_id = ${APEX_ID}
    )
    SELECT k.user_id, u.nick
    FROM kabo k
    JOIN apex a ON a.user_id = k.user_id
    JOIN "user" u ON u.id = k.user_id
    ORDER BY k.user_id
  `);

  console.log('\nJugadores compartidos KABO ∩ Apex (esperado: Andrés y Kevin):');
  console.table(solapamiento);

  const [invalidos] = await sequelize.query(`
    SELECT tp.user_id, u.nick, COUNT(DISTINCT tp.team_id)::int AS equipos
    FROM torneo_plantilla tp
    JOIN "user" u ON u.id = tp.user_id
    WHERE tp.torneo_id = ${TORNEO_ID}
      AND tp.user_id NOT IN (${ANDRES_ID}, ${KEVIN_ID})
    GROUP BY tp.user_id, u.nick
    HAVING COUNT(DISTINCT tp.team_id) > 1
    ORDER BY equipos DESC, tp.user_id
    LIMIT 20
  `);

  if (invalidos.length) {
    console.warn('\n⚠ Jugadores en más de un equipo (excl. Andrés/Kevin):');
    console.table(invalidos);
  } else {
    console.log('\n✅ Cada jugador pertenece a un solo equipo en el torneo (excepto Andrés y Kevin).');
  }

  console.log(`\n✅ Torneo Elizabeth listo con ${resumen.length} equipos inscritos.`);
} catch (error) {
  console.error('Error:', error.message);
  console.error(error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
