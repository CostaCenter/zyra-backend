import sequelize from '../src/config/database.js';

const q = async (label, sql) => {
  const [rows] = await sequelize.query(sql);
  console.log(`\n=== ${label} ===`);
  console.table(rows);
  return rows;
};

try {
  await q('Torneo Elizabeth', `
    SELECT id, nombre, estado, max_equipos, sport_id, creado_por_user_id
    FROM torneos WHERE nombre ILIKE '%elizabeth%' OR id = 20
  `);

  await q('Inscripciones actuales', `
    SELECT ti.id, ti.team_id, t.name, ti.estado
    FROM torneo_inscripciones ti
    JOIN "Team" t ON t.id = ti.team_id
    WHERE ti.torneo_id = 20
    ORDER BY t.name
  `);

  await q('KABO plantel', `
    SELECT tm.user_id, u.nick, u.name, tm.rol
    FROM "Team_Miembros" tm
    JOIN "user" u ON u.id = tm.user_id
    WHERE tm.team_id = 12 AND tm.estado_invitacion = 'ACEPTADO'
    ORDER BY tm.user_id
  `);

  await q('Apex plantel', `
    SELECT tm.user_id, u.nick, u.name, tm.rol
    FROM "Team_Miembros" tm
    JOIN "user" u ON u.id = tm.user_id
    WHERE tm.team_id = 40 AND tm.estado_invitacion = 'ACEPTADO'
    ORDER BY tm.user_id
  `);

  await q('KABO plantilla torneo 20', `
    SELECT tp.user_id, u.nick, tp.dorsal_torneo, tp.posicion_torneo
    FROM torneo_plantilla tp
    JOIN "user" u ON u.id = tp.user_id
    WHERE tp.torneo_id = 20 AND tp.team_id = 12
    ORDER BY tp.dorsal_torneo
  `);

  await q('Apex plantilla torneo 20', `
    SELECT tp.user_id, u.nick, tp.dorsal_torneo, tp.posicion_torneo
    FROM torneo_plantilla tp
    JOIN "user" u ON u.id = tp.user_id
    WHERE tp.torneo_id = 20 AND tp.team_id = 40
    ORDER BY tp.dorsal_torneo
  `);

  await q('Equipos voley existentes', `
    SELECT id, name, capitan_id, sport_id
    FROM "Team"
    WHERE sport_id = (SELECT sport_id FROM torneos WHERE id = 20)
    ORDER BY name
  `);

  await q('Usuarios SEED disponibles', `
    SELECT id, nick, name FROM "user"
    WHERE nick LIKE 'SEED_%' OR es_dato_prueba = true
    ORDER BY id
  `);

  await q('Usuarios en torneo 20 (plantillas)', `
    SELECT DISTINCT tp.user_id, u.nick, tp.team_id, t.name AS team_name
    FROM torneo_plantilla tp
    JOIN "user" u ON u.id = tp.user_id
    JOIN "Team" t ON t.id = tp.team_id
    WHERE tp.torneo_id = 20
    ORDER BY tp.user_id
  `);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
