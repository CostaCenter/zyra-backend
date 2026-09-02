/**
 * Diagnóstico: nóminas por partido (estados VALIDADO vs PENDIENTE).
 * node scripts/diag-nominas-partido.mjs [partidoId]
 */
import sequelize from '../src/config/database.js';

const partidoIdArg = process.argv[2] ? parseInt(process.argv[2], 10) : null;

try {
  if (partidoIdArg) {
    const rows = await sequelize.query(
      `
      SELECT pn.id, pn.partido_id, pn.team_id, t.name AS equipo,
             pn.user_id, pn.dorsal, pn.rol_nomina, pn.estado_validacion
      FROM partido_nominas pn
      JOIN "Team" t ON t.id = pn.team_id
      WHERE pn.partido_id = :partidoId
      ORDER BY pn.team_id, pn.dorsal
      `,
      { replacements: { partidoId: partidoIdArg }, type: sequelize.QueryTypes.SELECT }
    );
    console.log(`\n=== Nóminas partido #${partidoIdArg} (${rows.length} filas) ===\n`);
    if (rows.length === 0) {
      console.log('(sin filas en partido_nominas)');
    } else {
      console.table(rows);
      const validados = rows.filter((r) => r.estado_validacion === 'VALIDADO');
      const pendientes = rows.filter((r) => r.estado_validacion === 'PENDIENTE');
      console.log(`VALIDADO: ${validados.length} | PENDIENTE: ${pendientes.length} | otros: ${rows.length - validados.length - pendientes.length}`);
    }
  } else {
    const partidos = await sequelize.query(
      `
      SELECT p.id, p.state, p.datetime, tor.nombre AS torneo,
             COUNT(pn.id) AS total_nominas,
             COUNT(pn.id) FILTER (WHERE pn.estado_validacion = 'VALIDADO') AS validadas,
             COUNT(pn.id) FILTER (WHERE pn.estado_validacion = 'PENDIENTE') AS pendientes
      FROM partidos p
      LEFT JOIN torneos tor ON tor.id = p.torneo_id
      LEFT JOIN partido_nominas pn ON pn.partido_id = p.id
      WHERE p.state IN ('PROGRAMADO', 'pendiente', 'EN_CURSO')
      GROUP BY p.id, p.state, p.datetime, tor.nombre
      ORDER BY p.datetime NULLS LAST, p.id DESC
      LIMIT 15
      `,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('\n=== Partidos programados/en curso — resumen nóminas ===\n');
    console.table(partidos);
    console.log('\nUso: node scripts/diag-nominas-partido.mjs <partidoId>\n');
  }
} catch (e) {
  console.error(e.message ?? e);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
