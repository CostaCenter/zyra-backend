/**
 * Pobla Zyra Club con 14 jugadores únicos por división (sin repetir entre divisiones)
 * y los distribuye en los equipos de cada categoría.
 *
 * Ejecutar: node scripts/seed-zyra-club-plantel.mjs
 */
import sequelize from '../src/config/database.js';

const CLUB_ID = 2;
const JUGADORES_POR_DIVISION = 14;

const POSICIONES = [
  'ARMADOR', 'PUNTA', 'CENTRAL', 'OPUESTO', 'PUNTA',
  'CENTRAL', 'LÍBERO', 'PUNTA', 'ARMADOR', 'CENTRAL',
  'OPUESTO', 'PUNTA', 'CENTRAL', 'PUNTA',
];

async function main() {
  const [clubRows] = await sequelize.query(
    `SELECT id, nombre, admin_id FROM clubs WHERE id = :clubId`,
    { replacements: { clubId: CLUB_ID } },
  );
  const club = clubRows[0];
  if (!club) throw new Error('Club no encontrado');

  const [divisions] = await sequelize.query(
    `SELECT id, nombre FROM club_divisiones WHERE club_id = :clubId ORDER BY id`,
    { replacements: { clubId: CLUB_ID } },
  );
  if (divisions.length !== 4) {
    throw new Error(`Se esperaban 4 divisiones, hay ${divisions.length}`);
  }

  const [teams] = await sequelize.query(
    `SELECT id, name, club_division_id, capitan_id FROM "Team"
     WHERE club_id = :clubId ORDER BY club_division_id, id`,
    { replacements: { clubId: CLUB_ID } },
  );

  const teamsByDivision = new Map();
  for (const team of teams) {
    const list = teamsByDivision.get(team.club_division_id) ?? [];
    list.push(team);
    teamsByDivision.set(team.club_division_id, list);
  }

  const [existingAtletas] = await sequelize.query(
    `SELECT cda.usuario_id, cda.club_division_id
     FROM club_division_atletas cda
     JOIN club_divisiones cd ON cd.id = cda.club_division_id
     WHERE cd.club_id = :clubId`,
    { replacements: { clubId: CLUB_ID } },
  );

  const assignedGlobal = new Set(existingAtletas.map((a) => a.usuario_id));
  assignedGlobal.add(club.admin_id);

  const existingByDivision = new Map();
  for (const row of existingAtletas) {
    const list = existingByDivision.get(row.club_division_id) ?? [];
    list.push(row.usuario_id);
    existingByDivision.set(row.club_division_id, list);
  }

  const [allUsers] = await sequelize.query(
    `SELECT id, nick, name FROM "user" ORDER BY id`,
  );
  const userPool = allUsers
    .map((u) => u.id)
    .filter((id) => !assignedGlobal.has(id));

  if (userPool.length < (JUGADORES_POR_DIVISION * divisions.length) - existingAtletas.length) {
    throw new Error(`Usuarios insuficientes en BD (${userPool.length} disponibles)`);
  }

  let poolIndex = 0;
  const plan = [];

  for (const division of divisions) {
    const current = existingByDivision.get(division.id) ?? [];
    const needed = JUGADORES_POR_DIVISION - current.length;
    const picked = [...current];

    for (let i = 0; i < needed; i += 1) {
      const userId = userPool[poolIndex];
      poolIndex += 1;
      if (!userId) throw new Error('Pool de usuarios agotado');
      picked.push(userId);
      assignedGlobal.add(userId);
    }

    if (picked.length !== JUGADORES_POR_DIVISION) {
      throw new Error(`División ${division.nombre} no llegó a 14 jugadores`);
    }

    plan.push({
      division,
      userIds: picked,
      teams: teamsByDivision.get(division.id) ?? [],
    });
  }

  // Verificar unicidad global
  const allAssigned = plan.flatMap((p) => p.userIds);
  if (new Set(allAssigned).size !== allAssigned.length) {
    throw new Error('Hay jugadores repetidos entre divisiones');
  }

  await sequelize.transaction(async (transaction) => {
    for (const entry of plan) {
      const { division, userIds, teams: divisionTeams } = entry;

      for (let i = 0; i < userIds.length; i += 1) {
        const usuarioId = userIds[i];
        const dorsal = i + 1;
        const posicion = POSICIONES[i % POSICIONES.length];

        const [atletaExistente] = await sequelize.query(
          `SELECT id FROM club_division_atletas
           WHERE club_division_id = :divisionId AND usuario_id = :usuarioId`,
          { replacements: { divisionId: division.id, usuarioId }, transaction },
        );

        if (atletaExistente.length) {
          await sequelize.query(
            `UPDATE club_division_atletas
             SET dorsal = :dorsal, posicion = :posicion, estado = 'ACTIVO'
             WHERE id = :id`,
            {
              replacements: { dorsal, posicion, id: atletaExistente[0].id },
              transaction,
            },
          );
        } else {
          await sequelize.query(
            `INSERT INTO club_division_atletas
               (club_division_id, usuario_id, dorsal, posicion, estado, fecha_ingreso)
             VALUES (:divisionId, :usuarioId, :dorsal, :posicion, 'ACTIVO', NOW())`,
            {
              replacements: {
                divisionId: division.id,
                usuarioId,
                dorsal,
                posicion,
              },
              transaction,
            },
          );
        }

        await sequelize.query(
          `INSERT INTO club_miembros (club_id, usuario_id, rol_membresia, estado, fecha_ingreso)
           VALUES (:clubId, :usuarioId, 'MIEMBRO', 'ACTIVO', NOW())
           ON CONFLICT (club_id, usuario_id) DO NOTHING`,
          { replacements: { clubId: CLUB_ID, usuarioId }, transaction },
        );
      }

      if (!divisionTeams.length) continue;

      const teamIds = divisionTeams.map((t) => t.id);
      const chunks = divisionTeams.length === 1
        ? [userIds]
        : [
            userIds.slice(0, Math.ceil(userIds.length / 2)),
            userIds.slice(Math.ceil(userIds.length / 2)),
          ];

      for (let t = 0; t < divisionTeams.length; t += 1) {
        const team = divisionTeams[t];
        const roster = chunks[t] ?? [];

        for (const usuarioId of roster) {
          const otrosEquipos = teamIds.filter((id) => id !== team.id);
          if (otrosEquipos.length) {
            await sequelize.query(
              `DELETE FROM "Team_Miembros"
               WHERE user_id = :usuarioId AND team_id = ANY(ARRAY[${otrosEquipos.join(',')}])`,
              { replacements: { usuarioId }, transaction },
            );
          }

          const rol = usuarioId === team.capitan_id ? 'CAPITAN' : 'JUGADOR';
          const [existente] = await sequelize.query(
            `SELECT id FROM "Team_Miembros" WHERE team_id = :teamId AND user_id = :usuarioId`,
            { replacements: { teamId: team.id, usuarioId }, transaction },
          );

          if (existente.length) {
            await sequelize.query(
              `UPDATE "Team_Miembros"
               SET rol = :rol, estado_invitacion = 'ACEPTADO', fecha_union = COALESCE(fecha_union, NOW())
               WHERE id = :id`,
              { replacements: { rol, id: existente[0].id }, transaction },
            );
          } else {
            await sequelize.query(
              `INSERT INTO "Team_Miembros"
                 (team_id, user_id, rol, estado_invitacion, fecha_union, dorsal_habitual)
               VALUES (:teamId, :usuarioId, :rol, 'ACEPTADO', NOW(), NULL)`,
              { replacements: { teamId: team.id, usuarioId, rol }, transaction },
            );
          }
        }

        const capitanId = team.capitan_id;
        const rosterIds = roster.filter((id) => id !== capitanId);
        if (rosterIds.length) {
          await sequelize.query(
            `DELETE FROM "Team_Miembros"
             WHERE team_id = :teamId
               AND user_id != :capitanId
               AND user_id NOT IN (${rosterIds.join(',')})`,
            { replacements: { teamId: team.id, capitanId }, transaction },
          );
        } else {
          await sequelize.query(
            `DELETE FROM "Team_Miembros"
             WHERE team_id = :teamId AND user_id != :capitanId`,
            { replacements: { teamId: team.id, capitanId }, transaction },
          );
        }
      }
    }
  });

  console.log(`\n✅ Zyra Club poblado: ${JUGADORES_POR_DIVISION} jugadores × ${divisions.length} divisiones = ${allAssigned.length} atletas únicos\n`);

  for (const entry of plan) {
    const teamSummary = entry.teams.map((t) => t.name).join(', ') || 'sin equipos';
    console.log(`  • ${entry.division.nombre} (id ${entry.division.id}): ${entry.userIds.length} jugadores → ${teamSummary}`);
  }

  const [verify] = await sequelize.query(
    `SELECT cd.nombre, COUNT(cda.id)::int AS jugadores
     FROM club_divisiones cd
     LEFT JOIN club_division_atletas cda ON cda.club_division_id = cd.id
     WHERE cd.club_id = :clubId
     GROUP BY cd.id, cd.nombre
     ORDER BY cd.id`,
    { replacements: { clubId: CLUB_ID } },
  );
  console.log('\nVerificación:', verify);

  const [dupes] = await sequelize.query(
    `SELECT usuario_id, COUNT(*)::int AS divisiones
     FROM club_division_atletas cda
     JOIN club_divisiones cd ON cd.id = cda.club_division_id
     WHERE cd.club_id = :clubId
     GROUP BY usuario_id
     HAVING COUNT(*) > 1`,
    { replacements: { clubId: CLUB_ID } },
  );
  if (dupes.length) {
    console.error('⚠️ Jugadores en más de una división:', dupes);
  } else {
    console.log('✓ Ningún jugador repetido entre divisiones');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
