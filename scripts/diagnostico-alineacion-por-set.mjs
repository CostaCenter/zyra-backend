/**
 * Diagnóstico alineación por set — consulta partidos recientes en EN_CURSO o recién jugados.
 * Uso: node scripts/diagnostico-alineacion-por-set.mjs [partido_id]
 */
import sequelize from '../src/config/database.js';

const partidoIdArg = parseInt(process.argv[2], 10);

const query = partidoIdArg
  ? `
    SELECT p.id, p.state, p.datetime,
           md.sets_ganados_local, md.sets_ganados_visitante,
           md.puntos_favor, md.puntos_contra,
           md.metrica_estructura,
           md.actualizado_en
    FROM partidos p
    JOIN marcadores_detalle md ON md.partido_id = p.id
    WHERE p.id = :partidoId
  `
  : `
    SELECT p.id, p.state, p.datetime,
           md.sets_ganados_local, md.sets_ganados_visitante,
           md.puntos_favor, md.puntos_contra,
           md.metrica_estructura,
           md.actualizado_en
    FROM partidos p
    JOIN marcadores_detalle md ON md.partido_id = p.id
    WHERE p.state IN ('EN_CURSO', 'FINALIZADO')
      AND md.metrica_estructura->'parciales_sets' IS NOT NULL
      AND jsonb_array_length(COALESCE(md.metrica_estructura->'parciales_sets', '[]'::jsonb)) >= 1
    ORDER BY md.actualizado_en DESC
    LIMIT 5
  `;

try {
  const [rows] = await sequelize.query(query, {
    replacements: partidoIdArg ? { partidoId: partidoIdArg } : {},
  });

  if (!rows.length) {
    console.log('No se encontraron partidos con al menos 1 set jugado.');
    process.exit(0);
  }

  for (const row of rows) {
    const metrica = row.metrica_estructura ?? {};
    const parciales = metrica.parciales_sets ?? [];
    const setActual = parciales.length + 1;
    const puntosEnSet = (row.puntos_favor ?? 0) + (row.puntos_contra ?? 0);

    console.log('\n========== PARTIDO', row.id, '==========');
    console.log('state:', row.state);
    console.log('actualizado_en:', row.actualizado_en);
    console.log('sets:', row.sets_ganados_local, '-', row.sets_ganados_visitante);
    console.log('puntos set actual:', row.puntos_favor, '-', row.puntos_contra, '(total en set:', puntosEnSet, ')');
    console.log('parciales_sets:', JSON.stringify(parciales));
    console.log('set en juego (calculado):', setActual);
    console.log('--- metrica_estructura claves ---');
    console.log('  pendiente_alineacion_set:', metrica.pendiente_alineacion_set ?? '(ausente/null)');
    console.log('  pendiente_saque_set:', metrica.pendiente_saque_set ?? '(ausente/null)');
    console.log('  alineaciones_por_set keys:', metrica.alineaciones_por_set
      ? Object.keys(metrica.alineaciones_por_set)
      : '(ausente)');
    console.log('  saque_primero_por_set:', JSON.stringify(metrica.saque_primero_por_set ?? []));

    const [nominas] = await sequelize.query(
      `SELECT set_numero, team_id, estado_validacion, COUNT(*) AS filas
       FROM partido_nominas WHERE partido_id = :pid
       GROUP BY set_numero, team_id, estado_validacion
       ORDER BY set_numero, team_id`,
      { replacements: { pid: row.id } }
    );
    console.log('--- nominas por set/equipo ---');
    nominas.forEach((n) => {
      console.log(`  set ${n.set_numero} team ${n.team_id} ${n.estado_validacion}: ${n.filas} filas`);
    });

    const [eventosSet2] = await sequelize.query(
      `SELECT COUNT(*) AS total FROM eventos_partido ep
       WHERE ep.partido_id = :pid AND ep.tipo_evento = 'PUNTO'
       AND ep.id > (
         SELECT COALESCE(MAX(e2.id), 0) FROM eventos_partido e2
         WHERE e2.partido_id = :pid AND e2.tipo_evento = 'PUNTO'
         AND e2.id IN (
           SELECT id FROM eventos_partido WHERE partido_id = :pid AND tipo_evento = 'PUNTO'
           ORDER BY ocurrido_en_cliente, secuencia_local
           OFFSET GREATEST(0, (
             SELECT COUNT(*) FROM eventos_partido WHERE partido_id = :pid AND tipo_evento = 'PUNTO'
           ) - 1) LIMIT 1
         )
       )`,
      { replacements: { pid: row.id } }
    ).catch(() => [[{ total: '?' }]]);

    // Contar puntos después del cierre del set 1 (más simple: eventos totales)
    const [[{ total_puntos }]] = await sequelize.query(
      `SELECT COUNT(*) AS total_puntos FROM eventos_partido
       WHERE partido_id = :pid AND tipo_evento = 'PUNTO'`,
      { replacements: { pid: row.id } }
    );
    console.log('--- eventos ---');
    console.log('  total PUNTO registrados:', total_puntos);

    // Simular resolverPendienteAlineacionSet
    const pendienteEsperado =
      row.resultado_principal === 0
      && setActual > 1
      && puntosEnSet === 0
      && !tieneAlineacionSetCompleta(metrica.alineaciones_por_set, nominas, setActual)
        ? setActual
        : null;
    console.log('--- diagnóstico lógico ---');
    console.log('  pendiente_alineacion_set ESPERADO (si lógica OK):', pendienteEsperado ?? 'null');
    console.log('  ¿Coincide con DB?:', (metrica.pendiente_alineacion_set ?? null) === pendienteEsperado
      || (pendienteEsperado == null && !metrica.pendiente_alineacion_set)
      ? 'SÍ' : 'NO ⚠️');
    if (puntosEnSet > 0 && setActual >= 2 && !metrica.pendiente_alineacion_set) {
      console.log('  ⚠️ GRAVe: hay puntos en set', setActual, 'sin pendiente_alineacion_set previo');
    }
  }
} catch (err) {
  console.error('Error:', err.message ?? err);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}

function tieneAlineacionSetCompleta(alineacionesPorSet, nominasRows, setNumero) {
  const alin = alineacionesPorSet?.[setNumero] ?? alineacionesPorSet?.[String(setNumero)];
  if (
    Array.isArray(alin?.equipo_local) && alin.equipo_local.length === 6
    && Array.isArray(alin?.equipo_visitante) && alin.equipo_visitante.length === 6
  ) {
    return true;
  }
  const setsValidados = new Set(
    nominasRows
      .filter((n) => n.estado_validacion === 'VALIDADO' && Number(n.set_numero) === setNumero)
      .map((n) => n.team_id)
  );
  return setsValidados.size >= 2;
}
