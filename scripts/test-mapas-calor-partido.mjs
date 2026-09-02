/**
 * Valida mapas de calor contra un partido real en BD.
 * Uso: node scripts/test-mapas-calor-partido.mjs [partidoId] [teamId] [jugadorIdOpcional]
 */
import { sequelize, PartidoParticipantes } from '../src/db/db.js';
import { obtenerMapasCalorPartido } from '../src/services/mapasCalorPartidoService.js';
import { ordenarEventos, filtrarEventosValidos } from '../src/services/reducerPartido.js';

const partidoId = parseInt(process.argv[2] ?? '125', 10);
const teamId = parseInt(process.argv[3] ?? '40', 10);
const jugadorIdArg = process.argv[4] ? parseInt(process.argv[4], 10) : null;

console.log(`=== test-mapas-calor-partido #${partidoId} ===\n`);

try {
  const [eventosRows] = await sequelize.query(
    `SELECT id, tipo_evento, detalle_json
     FROM eventos_partido WHERE partido_id = :partidoId
     ORDER BY ocurrido_en_cliente ASC, secuencia_local ASC`,
    { replacements: { partidoId } }
  );

  const participantesRows = await PartidoParticipantes.findAll({
    where: { partido_id: partidoId },
    attributes: ['team_id', 'es_local'],
  });
  const participante = participantesRows.find((p) => Number(p.team_id) === teamId);
  const equipoPunto = participante?.es_local ? 'LOCAL' : 'VISITANTE';
  const equipoRival = equipoPunto === 'LOCAL' ? 'VISITANTE' : 'LOCAL';

  const validos = filtrarEventosValidos(ordenarEventos(eventosRows));
  const puntosTotal = validos.filter((e) => e.tipo_evento === 'PUNTO').length;
  const puntosEquipoJugador = validos.filter(
    (e) => e.tipo_evento === 'PUNTO'
      && e.detalle_json?.equipo === equipoPunto
      && e.detalle_json?.origen === 'JUGADOR'
  ).length;
  const puntosRival = validos.filter(
    (e) => e.tipo_evento === 'PUNTO'
      && e.detalle_json?.equipo === equipoRival
  ).length;

  let jugadorId = jugadorIdArg;
  if (!jugadorId && puntosEquipoJugador > 0) {
    const primerAnotador = validos.find(
      (e) => e.tipo_evento === 'PUNTO'
        && e.detalle_json?.origen === 'JUGADOR'
        && e.detalle_json?.jugador_id
    );
    jugadorId = primerAnotador?.detalle_json?.jugador_id ?? null;
  }

  const resultado = await obtenerMapasCalorPartido(partidoId, {
    teamId,
    jugadorId,
  });

  if (resultado.status !== 200) {
    console.error('Error:', resultado.message);
    process.exit(1);
  }

  console.log(`Puntos totales en partido: ${puntosTotal}`);
  console.log(`Puntos equipo propio (origen JUGADOR): ${puntosEquipoJugador}`);
  console.log(`Puntos rival (concedidos): ${puntosRival}`);
  if (jugadorId) console.log(`Jugador analizado: ${jugadorId}`);

  if (resultado.equipo) {
    console.log('\n--- Mapa equipo (efectividad) ---');
    resultado.equipo.zonas.forEach(({ zona, count }) => {
      console.log(`  Zona ${zona}: ${count}`);
    });
    console.log(`  Total: ${resultado.equipo.total}`);
    console.log(`  Validación cuadra: ${resultado.equipo.validacion.cuadra ? '✓' : '✗'}`);

    console.log('\n--- Mapa equipo (recibidos) ---');
    resultado.equipo.recibidos.zonas.forEach(({ zona, count }) => {
      console.log(`  Zona ${zona}: ${count}`);
    });
    console.log(`  Total rival (footer): ${resultado.equipo.recibidos.total}`);
    console.log(`  Suma zonas: ${resultado.equipo.recibidos.validacion.suma_zonas}`);
    console.log(`  Puntos rival esperados: ${resultado.equipo.recibidos.validacion.puntos_rival_partido}`);
    console.log(`  Validación zonas === rival: ${resultado.equipo.recibidos.validacion.cuadra ? '✓' : '✗'}`);
    console.log(`  Total rival === marcador: ${resultado.equipo.recibidos.total === puntosRival ? '✓' : '✗'}`);
  }

  if (resultado.jugador) {
    console.log('\n--- Mapa jugador (exposición) ---');
    resultado.jugador.zonas.forEach(({ zona, count }) => {
      console.log(`  Zona ${zona}: ${count}`);
    });
    console.log(`  Total (puntos en cancha): ${resultado.jugador.total}`);
    console.log(`  Validación cuadra: ${resultado.jugador.validacion.cuadra ? '✓' : '✗'}`);

    console.log('\n--- Mapa jugador (recibidos) ---');
    resultado.jugador.recibidos.zonas.forEach(({ zona, count }) => {
      console.log(`  Zona ${zona}: ${count}`);
    });
    console.log(`  Total recibidos: ${resultado.jugador.recibidos.total}`);
    console.log(`  Validación cuadra: ${resultado.jugador.recibidos.validacion.cuadra ? '✓' : '✗'}`);
  }

  const okEquipo = !resultado.equipo || (
    resultado.equipo.validacion.cuadra
    && resultado.equipo.recibidos.validacion.cuadra
    && resultado.equipo.recibidos.total === puntosRival
  );
  const okJugador = !resultado.jugador || (
    resultado.jugador.validacion.cuadra
    && resultado.jugador.recibidos.validacion.cuadra
  );

  if (okEquipo && okJugador) {
    console.log('\n✓ Validación OK — efectividad, exposición y recibidos coherentes');
  } else {
    console.log('\n✗ Validación FALLÓ');
    process.exit(1);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await sequelize.close();
}
