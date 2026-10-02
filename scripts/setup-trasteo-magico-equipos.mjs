/**
 * Torneo "Trasteo mágico" (id=21): 4 equipos × 8 atletas sin repetir en el torneo.
 *
 * Ejecutar: node scripts/setup-trasteo-magico-equipos.mjs
 */
import sequelize from '../src/config/database.js';
import { Torneos, TorneoInscripcion, Team, DataTeam } from '../src/db/db.js';

const TORNEO_ID = 21;
const TORNEO_NOMBRE_ESPERADO = 'Trasteo mágico';
const JUGADORES_POR_EQUIPO = 8;
const NUM_EQUIPOS = 4;

const TEAM_NAMES = [
  'TM Bruma',
  'TM Chispa',
  'TM Orbe',
  'TM Viento',
];

/** 32 atletas SEED únicos (135–166), sin solapamiento entre equipos */
const BLOQUES_JUGADORES = [
  [135, 136, 137, 138, 139, 140, 141, 142],
  [143, 144, 145, 146, 147, 148, 149, 150],
  [151, 152, 153, 154, 155, 156, 157, 158],
  [159, 160, 161, 162, 163, 164, 165, 166],
];

const POS_VOLEY = ['ARMADOR', 'CENTRAL', 'PUNTA', 'OPUESTO', 'LÍBERO'];
const MANOS = ['DERECHA', 'IZQUIERDA'];

function buildPlantillaEntries(userIds, capitanId) {
  return userIds.map((userId, index) => {
    const posicion = POS_VOLEY[index % POS_VOLEY.length];
    return {
      user_id: userId,
      rol: userId === capitanId ? 'CAPITAN' : 'JUGADOR',
      dorsal: index + 1,
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

async function syncEquipo(transaction, teamId, capitanId, plantilla) {
  await sequelize.query(
    `UPDATE "Team" SET capitan_id = :capitanId, sport_id = (SELECT sport_id FROM torneos WHERE id = :torneoId)
     WHERE id = :teamId`,
    { replacements: { capitanId, teamId, torneoId: TORNEO_ID }, transaction },
  );

  for (const jugador of plantilla) {
    await upsertMiembro(transaction, teamId, jugador);
    await upsertPlantilla(transaction, teamId, jugador);
  }
}

async function inscribirEquipo(transaction, teamId, organizadorId) {
  const existente = await TorneoInscripcion.findOne({
    where: { torneo_id: TORNEO_ID, team_id: teamId },
    transaction,
  });

  if (existente) {
    await existente.update({
      estado: 'ACEPTADA',
      resuelto_por_id: organizadorId,
      resuelto_at: new Date(),
    }, { transaction });
    return 'actualizada';
  }

  await TorneoInscripcion.create({
    torneo_id: TORNEO_ID,
    team_id: teamId,
    origen: 'INVITACION_TORNEO',
    iniciado_por_id: organizadorId,
    estado: 'ACEPTADA',
    resuelto_por_id: organizadorId,
    resuelto_at: new Date(),
  }, { transaction });

  return 'creada';
}

async function crearORecuperarEquipo(transaction, name, sportId, capitanId) {
  let equipo = await Team.findOne({ where: { name }, transaction });
  if (equipo) {
    await equipo.update({ sport_id: sportId, capitan_id: capitanId, es_dato_prueba: true }, { transaction });
    return { equipo, accion: 'existente' };
  }

  equipo = await Team.create({
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
    games: 0,
    win: 0,
    lose: 0,
    draw: 0,
    total: 0,
  }, { transaction });

  return { equipo, accion: 'creado' };
}

function validarBloques() {
  const flat = BLOQUES_JUGADORES.flat();
  if (BLOQUES_JUGADORES.length !== NUM_EQUIPOS) {
    throw new Error(`Se esperaban ${NUM_EQUIPOS} bloques de jugadores`);
  }
  for (const bloque of BLOQUES_JUGADORES) {
    if (bloque.length !== JUGADORES_POR_EQUIPO) {
      throw new Error(`Cada equipo debe tener ${JUGADORES_POR_EQUIPO} jugadores`);
    }
  }
  const uniq = new Set(flat);
  if (uniq.size !== flat.length) {
    throw new Error('Hay user_id repetidos entre bloques de equipos');
  }
  if (flat.length !== NUM_EQUIPOS * JUGADORES_POR_EQUIPO) {
    throw new Error('Total de jugadores incorrecto');
  }
}

try {
  console.log('=== setup-trasteo-magico-equipos ===\n');
  validarBloques();

  const torneo = await Torneos.findByPk(TORNEO_ID);
  if (!torneo || torneo.nombre !== TORNEO_NOMBRE_ESPERADO) {
    throw new Error(
      `Torneo id=${TORNEO_ID} debe ser "${TORNEO_NOMBRE_ESPERADO}" (actual: ${torneo?.nombre ?? 'null'})`,
    );
  }

  const organizadorId = torneo.creado_por_user_id;
  console.log(`Torneo: id=${torneo.id} · "${torneo.nombre}" · sport_id=${torneo.sport_id}`);
  console.log(`Organizador resolución inscripciones: user_id=${organizadorId}\n`);

  const allUserIds = BLOQUES_JUGADORES.flat();
  const [usersOk] = await sequelize.query(
    `SELECT id FROM "user" WHERE id IN (${allUserIds.join(',')})`,
  );
  if (usersOk.length !== allUserIds.length) {
    throw new Error(`Faltan usuarios en BD (esperados ${allUserIds.length}, encontrados ${usersOk.length})`);
  }

  const [ocupadosTorneo] = await sequelize.query(
    `SELECT tp.user_id, u.nick, t.name AS equipo
     FROM torneo_plantilla tp
     JOIN "user" u ON u.id = tp.user_id
     JOIN "Team" t ON t.id = tp.team_id
     WHERE tp.torneo_id = :tid AND tp.user_id IN (${allUserIds.join(',')})`,
    { replacements: { tid: TORNEO_ID } },
  );
  if (ocupadosTorneo.length) {
    console.table(ocupadosTorneo);
    throw new Error('Algún jugador del plan ya está en plantilla de otro equipo en este torneo');
  }

  const resultados = await sequelize.transaction(async (transaction) => {
    const equiposCreados = [];

    for (let i = 0; i < NUM_EQUIPOS; i += 1) {
      const nombre = TEAM_NAMES[i];
      const userIds = BLOQUES_JUGADORES[i];
      const capitanId = userIds[0];
      const plantilla = buildPlantillaEntries(userIds, capitanId);

      const { equipo, accion } = await crearORecuperarEquipo(
        transaction,
        nombre,
        torneo.sport_id,
        capitanId,
      );

      await syncEquipo(transaction, equipo.id, capitanId, plantilla);
      const ins = await inscribirEquipo(transaction, equipo.id, organizadorId);

      equiposCreados.push({
        teamId: equipo.id,
        name: equipo.name,
        accionEquipo: accion,
        inscripcion: ins,
        jugadores: userIds.length,
      });
    }

    return equiposCreados;
  });

  console.log('Equipos:');
  for (const row of resultados) {
    console.log(
      `  ✓ ${row.name} (id=${row.teamId}) — equipo ${row.accionEquipo}, inscripción ${row.inscripcion}, ${row.jugadores} atletas`,
    );
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

  console.log('\nResumen inscripciones + plantilla:');
  console.table(resumen);

  const [dup] = await sequelize.query(`
    SELECT user_id, COUNT(*)::int AS veces
    FROM torneo_plantilla
    WHERE torneo_id = ${TORNEO_ID}
    GROUP BY user_id
    HAVING COUNT(*) > 1
  `);

  if (dup.length) {
    console.table(dup);
    throw new Error('VALIDACIÓN FALLIDA: hay atletas repetidos en el torneo');
  }

  const [total] = await sequelize.query(`
    SELECT COUNT(DISTINCT user_id)::int AS atletas,
           COUNT(DISTINCT team_id)::int AS equipos
    FROM torneo_plantilla WHERE torneo_id = ${TORNEO_ID}
  `);

  console.log('\n✅ Trasteo mágico listo:', total[0]);
  console.log(`   ${total[0].equipos} equipos · ${total[0].atletas} atletas únicos en plantilla`);
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
