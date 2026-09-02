import sequelize from '../src/config/database.js';

const TEAM_ID = 40;

try {
  const [participaciones] = await sequelize.query(
    `SELECT pp.partido_id, pp.es_local, p.state, p.datetime, p.torneo_id
     FROM "Partido_Participantes" pp
     JOIN partidos p ON p.id = pp.partido_id
     WHERE pp.team_id = :teamId
     ORDER BY p.datetime DESC NULLS LAST, pp.partido_id DESC
     LIMIT 10`,
    { replacements: { teamId: TEAM_ID } }
  );
  console.log('Participaciones partido:', participaciones);

  const [inscripciones] = await sequelize.query(
    `SELECT ti.id, ti.torneo_id, ti.estado, t.nombre AS torneo
     FROM torneo_inscripciones ti
     JOIN torneos t ON t.id = ti.torneo_id
     WHERE ti.team_id = :teamId`,
    { replacements: { teamId: TEAM_ID } }
  );
  console.log('Inscripciones torneo:', inscripciones);

  if (inscripciones[0]) {
    const torneoId = inscripciones[0].torneo_id;
    const [plantilla] = await sequelize.query(
      `SELECT tp.user_id, tp.dorsal, tp.posicion, u.nick, u.name
       FROM torneo_plantilla tp
       JOIN "user" u ON u.id = tp.user_id
       WHERE tp.torneo_id = :torneoId AND tp.team_id = :teamId
       ORDER BY tp.dorsal`,
      { replacements: { torneoId, teamId: TEAM_ID } }
    );
    console.log('Plantilla torneo:', plantilla);
  }

  const [seedPlayers] = await sequelize.query(
    `SELECT id, nick, name FROM "user"
     WHERE nick LIKE 'SEED_jugador_%'
     ORDER BY id
     LIMIT 12`
  );
  console.log('SEED jugadores disponibles:', seedPlayers);
} finally {
  await sequelize.close();
}
