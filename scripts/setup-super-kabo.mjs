/**
 * Plantel de "Super Kabo" (id=54): capitán Andrés + jugadores únicos
 * que no estén en otros equipos del torneo Elizabeth.
 *
 * Ejecutar: node scripts/setup-super-kabo.mjs
 */
import sequelize from '../src/config/database.js';
import { TorneoInscripcion } from '../src/db/db.js';

const TEAM_ID = 54;
const ANDRES_ID = 1;
const ORGANIZADOR_ID = 14;
const TORNEO_ID = 20;
const POS_VOLEY = ['ARMADOR', 'CENTRAL', 'PUNTA', 'OPUESTO', 'LÍBERO'];
const MANOS = ['DERECHA', 'IZQUIERDA'];

// Jugadores sin plantilla en torneo 20 (SEED_Eliz_76 → 83)
const JUGADORES_EXCLUSIVOS = [333, 334, 335, 336, 337, 338, 339, 340];

function buildPlantilla(userIds, capitanId) {
  return userIds.map((userId, index) => ({
    user_id: userId,
    rol: userId === capitanId ? 'CAPITAN' : 'JUGADOR',
    dorsal: index + 1,
    posicion: POS_VOLEY[index % POS_VOLEY.length],
    mano: MANOS[index % MANOS.length],
    es_libero: POS_VOLEY[index % POS_VOLEY.length] === 'LÍBERO',
  }));
}

async function upsertMiembro(transaction, jugador) {
  const [rows] = await sequelize.query(
    `SELECT id FROM "Team_Miembros" WHERE team_id = :teamId AND user_id = :userId`,
    { replacements: { teamId: TEAM_ID, userId: jugador.user_id }, transaction },
  );

  if (rows[0]) {
    await sequelize.query(
      `UPDATE "Team_Miembros"
       SET rol = :rol, estado_invitacion = 'ACEPTADO', dorsal_habitual = :dorsal
       WHERE id = :id`,
      { replacements: { rol: jugador.rol, dorsal: jugador.dorsal, id: rows[0].id }, transaction },
    );
    return 'actualizado';
  }

  await sequelize.query(
    `UPDATE "Team_Miembros" SET dorsal_habitual = NULL
     WHERE team_id = :teamId AND dorsal_habitual = :dorsal`,
    { replacements: { teamId: TEAM_ID, dorsal: jugador.dorsal }, transaction },
  );

  await sequelize.query(
    `INSERT INTO "Team_Miembros" (team_id, user_id, rol, estado_invitacion, fecha_union, dorsal_habitual)
     VALUES (:teamId, :userId, :rol, 'ACEPTADO', NOW(), :dorsal)`,
    {
      replacements: {
        teamId: TEAM_ID,
        userId: jugador.user_id,
        rol: jugador.rol,
        dorsal: jugador.dorsal,
      },
      transaction,
    },
  );
  return 'creado';
}

async function upsertPlantilla(transaction, jugador) {
  const [inscripcion] = await sequelize.query(
    `SELECT id FROM torneo_inscripciones
     WHERE torneo_id = :torneoId AND team_id = :teamId AND estado = 'ACEPTADA'`,
    { replacements: { torneoId: TORNEO_ID, teamId: TEAM_ID }, transaction },
  );

  if (!inscripcion[0]) return 'sin_inscripcion';

  const [rows] = await sequelize.query(
    `SELECT id FROM torneo_plantilla
     WHERE torneo_id = :torneoId AND team_id = :teamId AND user_id = :userId`,
    {
      replacements: { torneoId: TORNEO_ID, teamId: TEAM_ID, userId: jugador.user_id },
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
    return 'plantilla_actualizada';
  }

  await sequelize.query(
    `INSERT INTO torneo_plantilla
      (torneo_id, team_id, user_id, dorsal_torneo, posicion_torneo, mano_habil_torneo, es_libero, creado_at, actualizado_at)
     VALUES (:torneoId, :teamId, :userId, :dorsal, :posicion, :mano, :esLibero, NOW(), NOW())`,
    {
      replacements: {
        torneoId: TORNEO_ID,
        teamId: TEAM_ID,
        userId: jugador.user_id,
        ...payload,
      },
      transaction,
    },
  );
  return 'plantilla_creada';
}

async function inscribirEquipo(transaction) {
  const existente = await TorneoInscripcion.findOne({
    where: { torneo_id: TORNEO_ID, team_id: TEAM_ID },
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
    team_id: TEAM_ID,
    origen: 'INVITACION_TORNEO',
    iniciado_por_id: ORGANIZADOR_ID,
    estado: 'ACEPTADA',
    resuelto_por_id: ORGANIZADOR_ID,
    resuelto_at: new Date(),
  }, { transaction });

  return 'creada';
}

try {
  console.log('=== setup-super-kabo ===\n');

  const [teamRows] = await sequelize.query(
    `SELECT id, name, capitan_id FROM "Team" WHERE id = :teamId`,
    { replacements: { teamId: TEAM_ID } },
  );

  if (!teamRows[0]?.name?.toLowerCase().includes('super kabo')) {
    throw new Error(`Equipo id=${TEAM_ID} no es Super Kabo`);
  }

  const plantelUserIds = [ANDRES_ID, ...JUGADORES_EXCLUSIVOS];
  const plantilla = buildPlantilla(plantelUserIds, ANDRES_ID);

  const [ocupados] = await sequelize.query(`
    SELECT tp.user_id, u.nick, t.name AS otro_equipo
    FROM torneo_plantilla tp
    JOIN "user" u ON u.id = tp.user_id
    JOIN "Team" t ON t.id = tp.team_id
    WHERE tp.torneo_id = ${TORNEO_ID}
      AND tp.user_id IN (${JUGADORES_EXCLUSIVOS.join(',')})
      AND tp.team_id != ${TEAM_ID}
  `);

  if (ocupados.length) {
    console.warn('⚠ Jugadores ya usados en otro equipo del torneo:');
    console.table(ocupados);
    throw new Error('Hay jugadores que ya pertenecen a otro equipo en el torneo Elizabeth');
  }

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `UPDATE "Team" SET capitan_id = :andresId WHERE id = :teamId`,
      { replacements: { andresId: ANDRES_ID, teamId: TEAM_ID }, transaction },
    );

    const inscripcionAccion = await inscribirEquipo(transaction);
    console.log(`  ✓ Inscripción torneo Elizabeth — ${inscripcionAccion}`);

    for (const jugador of plantilla) {
      const miembro = await upsertMiembro(transaction, jugador);
      const plantillaAccion = await upsertPlantilla(transaction, jugador);
      console.log(`  ✓ user ${jugador.user_id} — miembro ${miembro}, ${plantillaAccion}`);
    }
  });

  const [plantel] = await sequelize.query(`
    SELECT tm.user_id, u.nick, u.name, tm.rol, tm.dorsal_habitual
    FROM "Team_Miembros" tm
    JOIN "user" u ON u.id = tm.user_id
    WHERE tm.team_id = ${TEAM_ID} AND tm.estado_invitacion = 'ACEPTADO'
    ORDER BY tm.rol DESC, tm.dorsal_habitual
  `);

  console.log('\nPlantel Super Kabo:');
  console.table(plantel);

  const [plantillaTorneo] = await sequelize.query(`
    SELECT tp.user_id, u.nick, tp.dorsal_torneo, tp.posicion_torneo
    FROM torneo_plantilla tp
    JOIN "user" u ON u.id = tp.user_id
    WHERE tp.torneo_id = ${TORNEO_ID} AND tp.team_id = ${TEAM_ID}
    ORDER BY tp.dorsal_torneo
  `);

  console.log('\nPlantilla torneo Elizabeth:');
  console.table(plantillaTorneo);

  console.log('\n✅ Super Kabo inscrito en torneo Elizabeth. Capitán: Andrés (id=1).');
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
