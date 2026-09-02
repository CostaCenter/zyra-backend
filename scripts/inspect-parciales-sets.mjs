import sequelize from '../src/config/database.js';

const [rows] = await sequelize.query(`
  SELECT
    p.id,
    p.name,
    p.score_local_final,
    p.score_visitante_final,
    s.name AS sport,
    md.sets_ganados_local,
    md.sets_ganados_visitante,
    md.metrica_estructura->'parciales_sets' AS parciales_sets
  FROM partidos p
  LEFT JOIN marcadores_detalle md ON md.partido_id = p.id
  LEFT JOIN sports s ON s.id = p.sport_id
  WHERE p.es_dato_prueba = true OR p.name LIKE 'SEED_%'
  ORDER BY p.id
`);

console.log(JSON.stringify(rows, null, 2));
await sequelize.close();
