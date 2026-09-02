import sequelize from '../src/config/database.js';

/**
 * Inserta 6 titulares VALIDADOS por equipo participante (para tests de inicio).
 */
export async function asegurarNominasValidadasPartido(partidoId, arbitroUserId = 1) {
  const [equipos] = await sequelize.query(
    `SELECT team_id FROM "Partido_Participantes"
     WHERE partido_id = :partidoId AND team_id IS NOT NULL`,
    { replacements: { partidoId } }
  );

  if (equipos.length < 2) return;

  await sequelize.query(
    `DELETE FROM partido_nominas WHERE partido_id = :partidoId`,
    { replacements: { partidoId } }
  );

  const [users] = await sequelize.query(
    `SELECT id FROM "user" ORDER BY id ASC LIMIT 24`
  );

  if (users.length < 12) {
    throw new Error('Se necesitan al menos 12 usuarios en BD para seed de nóminas de test.');
  }

  let userOffset = 0;

  for (const { team_id: teamId } of equipos) {
    for (let zona = 1; zona <= 6; zona += 1) {
      const userId = users[userOffset]?.id;
      userOffset += 1;
      if (!userId) break;

      await sequelize.query(
        `INSERT INTO partido_nominas
          (partido_id, team_id, user_id, dorsal, rol_nomina, propuesto_por_id, validado_por_id,
           estado_validacion, validado_at, zona, creado_at)
         VALUES
          (:partidoId, :teamId, :userId, :dorsal, 'TITULAR', :arbitroUserId, :arbitroUserId,
           'VALIDADO', NOW(), :zona, NOW())`,
        {
          replacements: {
            partidoId,
            teamId,
            userId,
            dorsal: zona,
            arbitroUserId,
            zona,
          },
        }
      );
    }
  }
}
