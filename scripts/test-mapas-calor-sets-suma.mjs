/**
 * Verifica que suma por set de mapas de calor = total del partido.
 * Uso: node scripts/test-mapas-calor-sets-suma.mjs [partidoId] [teamId]
 */
import { sequelize, MarcadoresDetalle, EventosPartido } from '../src/db/db.js';
import { obtenerMapasCalorPartido } from '../src/services/mapasCalorPartidoService.js';
import { ordenarEventos, filtrarEventosValidos } from '../src/services/reducerPartido.js';
import { resolverSetNumeroEvento } from '../src/services/sustitucionesVoleyService.js';

const partidoId = parseInt(process.argv[2] ?? '153', 10);
const teamId = parseInt(process.argv[3] ?? '40', 10);

const sumarZonas = (bloque) =>
  (bloque?.zonas ?? []).reduce((acc, { count }) => acc + (count ?? 0), 0);

function assert(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

function resolverSetsParaTest(marcador, eventosValidos, reglas) {
  const parciales = marcador?.metrica_estructura?.parciales_sets ?? [];
  let maxSet = parciales.length;
  for (const evento of eventosValidos) {
    if (evento.tipo_evento !== 'PUNTO' && evento.tipo_evento !== 'CAMBIO') continue;
    const setNum = resolverSetNumeroEvento(evento, eventosValidos, reglas);
    if (setNum != null) maxSet = Math.max(maxSet, setNum);
  }
  return Math.max(maxSet, 1);
}

try {
  console.log(`=== test-mapas-calor-sets-suma #${partidoId} team ${teamId} ===\n`);

  const marcador = await MarcadoresDetalle.findOne({ where: { partido_id: partidoId } });
  const eventosRows = await EventosPartido.findAll({
    where: { partido_id: partidoId },
    order: [['ocurrido_en_cliente', 'ASC'], ['secuencia_local', 'ASC']],
  });
  const reglas = {
    puntos_por_set: 25,
    ventaja_obligatoria: 2,
    sets_para_ganar: 3,
    ...(marcador?.reglas_arbitraje_snapshot ?? {}),
  };
  const eventosValidos = filtrarEventosValidos(ordenarEventos(eventosRows.map((e) => e.toJSON())));
  const setsJugados = resolverSetsParaTest(marcador, eventosValidos, reglas);
  console.log(`Sets con actividad: ${setsJugados}`);

  const totalPartido = await obtenerMapasCalorPartido(partidoId, { teamId });
  assert(totalPartido.status === 200, totalPartido.message ?? 'Error total partido');

  const dimensiones = ['efectividad', 'recibidos'];
  for (const dim of dimensiones) {
    const bloqueTotal = totalPartido.equipo?.[dim] ?? totalPartido.equipo;
    const sumaTotal = dim === 'efectividad'
      ? sumarZonas(totalPartido.equipo)
      : sumarZonas(totalPartido.equipo?.recibidos);

    console.log(`\n--- ${dim} (todo el partido) ---`);
    console.log(`  Total: ${sumaTotal}`);

    const acumuladoPorZona = Object.fromEntries([1, 2, 3, 4, 5, 6].map((z) => [z, 0]));
    let sumaSets = 0;

    for (let setNum = 1; setNum <= setsJugados; setNum += 1) {
      const resSet = await obtenerMapasCalorPartido(partidoId, { teamId, setNumero: setNum });
      assert(resSet.status === 200, `Set ${setNum}: ${resSet.message}`);

      const bloqueSet = dim === 'efectividad'
        ? resSet.equipo
        : resSet.equipo?.recibidos;
      const sumaSet = sumarZonas(bloqueSet);
      sumaSets += sumaSet;

      bloqueSet?.zonas?.forEach(({ zona, count }) => {
        acumuladoPorZona[zona] = (acumuladoPorZona[zona] ?? 0) + count;
      });

      console.log(`  Set ${setNum}: ${sumaSet}`);
    }

    const sumaZonasAcumuladas = Object.values(acumuladoPorZona).reduce((a, b) => a + b, 0);
    console.log(`  Suma sets: ${sumaSets}`);
    console.log(`  Suma zonas acumuladas: ${sumaZonasAcumuladas}`);

    assert(
      sumaSets === sumaTotal,
      `${dim}: suma sets (${sumaSets}) !== total partido (${sumaTotal})`
    );

    const zonasTotal = totalPartido.equipo?.[dim === 'efectividad' ? 'zonas' : 'recibidos']?.zonas
      ?? (dim === 'efectividad' ? totalPartido.equipo?.zonas : totalPartido.equipo?.recibidos?.zonas);

    for (const { zona, count } of zonasTotal ?? []) {
      assert(
        acumuladoPorZona[zona] === count,
        `${dim} zona ${zona}: acumulado sets (${acumuladoPorZona[zona]}) !== total (${count})`
      );
    }

    console.log(`  ✓ ${dim}: suma por set cuadra con todo el partido`);
  }

  console.log('\n✓ Validación OK — suma Set 1 + Set 2 + … = Todo el partido');
} catch (error) {
  console.error('\n✗', error.message);
  process.exit(1);
} finally {
  await sequelize.close();
}
