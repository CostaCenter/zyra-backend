/**
 * Configura Apex club para prueba real:
 * - Andrés (user 1) como capitán/dueño
 * - Jugadores SEED + Kevin en plantel y plantilla del torneo Zyra Celestial
 *
 * Ejecutar: node scripts/setup-apex-club-andres.mjs
 */
import sequelize from '../src/config/database.js';

const TEAM_ID = 40;
const ANDRES_ID = 1;
const KEVIN_ID = 14;
const TORNEO_ID = 14;

const PLANTEL = [
  { user_id: ANDRES_ID, rol: 'CAPITAN', dorsal: 1, posicion: 'ARMADOR', mano: 'DERECHA' },
  { user_id: KEVIN_ID, rol: 'JUGADOR', dorsal: 2, posicion: 'PUNTA', mano: 'DERECHA' },
  { user_id: 135, rol: 'JUGADOR', dorsal: 3, posicion: 'CENTRAL', mano: 'DERECHA' },
  { user_id: 136, rol: 'JUGADOR', dorsal: 4, posicion: 'OPUESTO', mano: 'DERECHA' },
  { user_id: 137, rol: 'JUGADOR', dorsal: 5, posicion: 'PUNTA', mano: 'IZQUIERDA' },
  { user_id: 138, rol: 'JUGADOR', dorsal: 6, posicion: 'CENTRAL', mano: 'DERECHA' },
  { user_id: 139, rol: 'JUGADOR', dorsal: 7, posicion: 'LÍBERO', mano: 'DERECHA', es_libero: true },
  { user_id: 140, rol: 'JUGADOR', dorsal: 8, posicion: 'PUNTA', mano: 'DERECHA' },
  { user_id: 141, rol: 'JUGADOR', dorsal: 9, posicion: 'ARMADOR', mano: 'DERECHA' },
  { user_id: 142, rol: 'JUGADOR', dorsal: 10, posicion: 'CENTRAL', mano: 'DERECHA' },
];

async function upsertMiembro(transaction, { user_id, rol }) {
  const [existentes] = await sequelize.query(
    `SELECT id, rol, estado_invitacion FROM "Team_Miembros"
     WHERE team_id = :teamId AND user_id = :userId`,
    { replacements: { teamId: TEAM_ID, userId: user_id }, transaction }
  );

  if (existentes.length > 0) {
    await sequelize.query(
      `UPDATE "Team_Miembros"
       SET rol = :rol, estado_invitacion = 'ACEPTADO', fecha_union = COALESCE(fecha_union, NOW())
       WHERE id = :id`,
      {
        replacements: { rol, id: existentes[0].id },
        transaction,
      }
    );
    return { accion: 'actualizado', user_id, miembro_id: existentes[0].id };
  }

  const [inserted] = await sequelize.query(
    `INSERT INTO "Team_Miembros" (team_id, user_id, rol, estado_invitacion, fecha_union, dorsal_habitual)
     VALUES (:teamId, :userId, :rol, 'ACEPTADO', NOW(), NULL)
     RETURNING id`,
    {
      replacements: { teamId: TEAM_ID, userId: user_id, rol },
      transaction,
    }
  );

  return { accion: 'creado', user_id, miembro_id: inserted[0].id };
}

async function upsertPlantilla(transaction, jugador) {
  const [existentes] = await sequelize.query(
    `SELECT id FROM torneo_plantilla
     WHERE torneo_id = :torneoId AND team_id = :teamId AND user_id = :userId`,
    {
      replacements: { torneoId: TORNEO_ID, teamId: TEAM_ID, userId: jugador.user_id },
      transaction,
    }
  );

  const esLibero = Boolean(jugador.es_libero);

  if (existentes.length > 0) {
    await sequelize.query(
      `UPDATE torneo_plantilla
       SET dorsal_torneo = :dorsal,
           posicion_torneo = :posicion,
           mano_habil_torneo = :mano,
           es_libero = :esLibero,
           actualizado_at = NOW()
       WHERE id = :id`,
      {
        replacements: {
          dorsal: jugador.dorsal,
          posicion: jugador.posicion,
          mano: jugador.mano,
          esLibero,
          id: existentes[0].id,
        },
        transaction,
      }
    );
    return { accion: 'plantilla_actualizada', user_id: jugador.user_id };
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
        dorsal: jugador.dorsal,
        posicion: jugador.posicion,
        mano: jugador.mano,
        esLibero,
      },
      transaction,
    }
  );

  return { accion: 'plantilla_creada', user_id: jugador.user_id };
}

try {
  console.log('=== setup-apex-club-andres ===\n');

  const [teamRows] = await sequelize.query(
    `SELECT id, name, capitan_id FROM "Team" WHERE id = :teamId`,
    { replacements: { teamId: TEAM_ID } }
  );

  if (!teamRows[0]) {
    throw new Error(`Equipo id=${TEAM_ID} no encontrado`);
  }

  console.log('Equipo antes:', teamRows[0]);

  const resultados = await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `UPDATE "Team" SET capitan_id = :andresId WHERE id = :teamId`,
      { replacements: { andresId: ANDRES_ID, teamId: TEAM_ID }, transaction }
    );

    const miembros = [];
    for (const jugador of PLANTEL) {
      miembros.push(await upsertMiembro(transaction, jugador));
      await upsertPlantilla(transaction, jugador);
    }

    return miembros;
  });

  console.log('\nMiembros procesados:');
  console.table(resultados);

  const [resumen] = await sequelize.query(
    `SELECT t.id, t.name, t.capitan_id, u.nick AS capitan_nick
     FROM "Team" t
     LEFT JOIN "user" u ON u.id = t.capitan_id
     WHERE t.id = :teamId`,
    { replacements: { teamId: TEAM_ID } }
  );
  console.log('\nEquipo después:', resumen[0]);

  const [miembrosFinal] = await sequelize.query(
    `SELECT tm.user_id, tm.rol, tm.estado_invitacion, u.nick, u.name
     FROM "Team_Miembros" tm
     JOIN "user" u ON u.id = tm.user_id
     WHERE tm.team_id = :teamId
     ORDER BY tm.rol DESC, tm.user_id`,
    { replacements: { teamId: TEAM_ID } }
  );
  console.log('\nPlantel final:');
  console.table(miembrosFinal);

  const [plantillaFinal] = await sequelize.query(
    `SELECT tp.user_id, tp.dorsal_torneo, tp.posicion_torneo, tp.es_libero, u.nick
     FROM torneo_plantilla tp
     JOIN "user" u ON u.id = tp.user_id
     WHERE tp.torneo_id = :torneoId AND tp.team_id = :teamId
     ORDER BY tp.dorsal_torneo`,
    { replacements: { torneoId: TORNEO_ID, teamId: TEAM_ID } }
  );
  console.log('\nPlantilla torneo Zyra Celestial:');
  console.table(plantillaFinal);

  const [partido] = await sequelize.query(
    `SELECT p.id, p.state, p.datetime
     FROM "Partido_Participantes" pp
     JOIN partidos p ON p.id = pp.partido_id
     WHERE pp.team_id = :teamId AND p.state IN ('PROGRAMADO', 'pendiente')
     ORDER BY p.id ASC
     LIMIT 1`,
    { replacements: { teamId: TEAM_ID } }
  );

  if (partido[0]) {
    console.log(`\nPartido sugerido para probar: id=${partido[0].id} (${partido[0].state})`);
  }

  console.log('\n✅ Listo. Inicia sesión como Andrés (user id=1) y usa Apex club.');
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
