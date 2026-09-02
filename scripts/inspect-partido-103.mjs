import sequelize from '../src/config/database.js';

const PARTIDO_ID = 103;

try {
  const [partido] = await sequelize.query(
    `SELECT id, state, torneo_id, arbitro_asignado_id, equipo_que_saca_inicial FROM partidos WHERE id = :id`,
    { replacements: { id: PARTIDO_ID } }
  );
  console.log('Partido:', partido[0]);

  const [equipos] = await sequelize.query(
    `SELECT pp.es_local, pp.team_id, t.name
     FROM "Partido_Participantes" pp
     JOIN "Team" t ON t.id = pp.team_id
     WHERE pp.partido_id = :id`,
    { replacements: { id: PARTIDO_ID } }
  );
  console.log('Equipos:', equipos);

  const [nominas] = await sequelize.query(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN estado_validacion = 'PENDIENTE' THEN 1 ELSE 0 END)::int AS pendientes
     FROM partido_nominas WHERE partido_id = :id`,
    { replacements: { id: PARTIDO_ID } }
  );
  console.log('Nominas:', nominas[0]);
} finally {
  await sequelize.close();
}
