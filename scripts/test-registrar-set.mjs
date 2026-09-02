import sequelize from '../src/config/database.js';
import {
  Partidos,
  MarcadoresDetalle,
  EventosPartido,
  ProgresionFixture
} from '../src/db/db.js';
import { ejecutarInicioPartido } from '../src/controllers/partidosController.js';
import { asegurarNominasValidadasPartido } from './test-helpers-nominas.mjs';
import { ejecutarRegistrarSet } from '../src/controllers/eventosController.js';

const TORNEO_ID = 2;
const GRUPO_A_ID = 1;
const ARBITRO_USER_ID = 1;

const resolverPartidoTorneo2GrupoA = async () => {
  const partido = await Partidos.findOne({
    where: { torneo_id: TORNEO_ID, grupo_division_id: GRUPO_A_ID },
    order: [['id', 'ASC']],
    attributes: ['id']
  });

  if (!partido) {
    throw new Error(
      `No hay partido en torneo_id=${TORNEO_ID} grupo_id=${GRUPO_A_ID}. Ejecuta test-generar-fixture.mjs primero.`
    );
  }

  return partido.id;
};

const SETS_PARTIDO = [
  { label: 'Set 1', puntos_local: 25, puntos_visitante: 20 },
  { label: 'Set 2', puntos_local: 20, puntos_visitante: 25 },
  { label: 'Set 3', puntos_local: 25, puntos_visitante: 22 },
  { label: 'Set 4', puntos_local: 22, puntos_visitante: 25 },
  { label: 'Set 5 (decisivo)', puntos_local: 15, puntos_visitante: 10 }
];

const resetearEIniciarPartido = async (partidoId) => {
  await MarcadoresDetalle.destroy({ where: { partido_id: partidoId } });
  await EventosPartido.destroy({ where: { partido_id: partidoId } });
  await Partidos.update(
    { state: 'PROGRAMADO', arbitro_asignado_id: ARBITRO_USER_ID, equipo_que_saca_inicial: 'local' },
    { where: { id: partidoId } }
  );

  await asegurarNominasValidadasPartido(partidoId, ARBITRO_USER_ID);
  const inicio = await ejecutarInicioPartido(partidoId, ARBITRO_USER_ID);
  if (inicio.status !== 200) {
    throw new Error(`No se pudo iniciar partido ${partidoId}: ${inicio.message}`);
  }

  console.log(`Partido ${partidoId} reiniciado e iniciado (reglas 25/2/3).`);
};

const imprimirMarcadorResumen = (etiqueta, resultado) => {
  if (resultado.status !== 200 || !resultado.marcador) {
    console.log(`${etiqueta}: ERROR`, resultado);
    return;
  }

  const m = resultado.marcador;
  console.log(
    `${etiqueta}: sets ${m.sets_ganados_local}-${m.sets_ganados_visitante}, ` +
      `resultado_principal=${m.resultado_principal}, ` +
      `puntos en curso ${m.puntos_favor}-${m.puntos_contra}`
  );
};

const consultarEstadoPartido = async (partidoId) => {
  const [filas] = await sequelize.query(
    'SELECT id, state, score_local_final, score_visitante_final FROM partidos WHERE id = :partidoId',
    { replacements: { partidoId } }
  );
  return filas[0] ?? null;
};

const imprimirProgresionFixture = async (partidoId, propagacionUltimoSet) => {
  const progresiones = await ProgresionFixture.findAll({
    where: { partido_origen_id: partidoId },
    attributes: ['id', 'partido_destino_id', 'posicion_destino', 'condicion_avance']
  });

  console.log('\n--- ProgresionFixture ---');
  if (progresiones.length === 0) {
    console.log('No aplica: el partido no tiene ProgresionFixture de destino configurada.');
    return;
  }

  console.table(progresiones.map((p) => p.toJSON()));

  if (propagacionUltimoSet) {
    console.log('Resultado propagación (al finalizar el partido):');
    console.log(JSON.stringify(propagacionUltimoSet, null, 2));
  }
};

try {
  console.log('=== test-registrar-set ===\n');

  const PARTIDO_ID = await resolverPartidoTorneo2GrupoA();
  console.log(`Usando partido id=${PARTIDO_ID} (torneo_id=${TORNEO_ID}, grupo_id=${GRUPO_A_ID})\n`);

  await resetearEIniciarPartido(PARTIDO_ID);

  let propagacionFinal = null;

  for (const set of SETS_PARTIDO) {
    console.log(`\n--- Registrar ${set.label}: ${set.puntos_local}-${set.puntos_visitante} ---`);
    const resultado = await ejecutarRegistrarSet(
      PARTIDO_ID,
      ARBITRO_USER_ID,
      set.puntos_local,
      set.puntos_visitante
    );
    console.log(JSON.stringify(resultado, null, 2));
    imprimirMarcadorResumen(set.label, resultado);

    if (resultado.propagacion) {
      propagacionFinal = resultado.propagacion;
    }
  }

  const estadoFinal = await consultarEstadoPartido(PARTIDO_ID);
  console.log('\n--- Estado final del partido ---');
  console.table([estadoFinal]);

  if (estadoFinal?.score_local_final === 3 && estadoFinal?.score_visitante_final === 2) {
    console.log('✓ score_local_final/score_visitante_final = 3-2 (sincronizado con marcador).');
  } else {
    console.error(
      `✗ scores esperados 3-2, recibidos: ${estadoFinal?.score_local_final}-${estadoFinal?.score_visitante_final}`
    );
    process.exitCode = 1;
  }

  const marcadorFinal = await MarcadoresDetalle.findOne({ where: { partido_id: PARTIDO_ID } });

  if (estadoFinal?.state === 'FINALIZADO') {
    console.log('✓ partido.state = FINALIZADO');
  } else {
    console.error(`✗ partido.state esperado FINALIZADO, recibido: ${estadoFinal?.state}`);
    process.exitCode = 1;
  }

  if (marcadorFinal?.resultado_principal === 1) {
    console.log('✓ resultado_principal = 1 (local ganó 3-2)');
  } else {
    console.error(`✗ resultado_principal esperado 1, recibido: ${marcadorFinal?.resultado_principal}`);
    process.exitCode = 1;
  }

  console.log('\n--- Intento registrar 6to set (debe bloquear) ---');
  const sextoSet = await ejecutarRegistrarSet(PARTIDO_ID, ARBITRO_USER_ID, 25, 20);
  console.log(JSON.stringify(sextoSet, null, 2));

  if (
    sextoSet.status === 400 &&
    sextoSet.message === 'El partido ya finalizó, no se pueden registrar más sets'
  ) {
    console.log('✓ 6to set bloqueado correctamente.');
  } else {
    console.error('✗ El 6to set no devolvió el error esperado.');
    process.exitCode = 1;
  }

  console.log('\n--- Marcador inválido 25-24 (debe bloquear ventaja) ---');
  await resetearEIniciarPartido(PARTIDO_ID);

  const invalido = await ejecutarRegistrarSet(PARTIDO_ID, ARBITRO_USER_ID, 25, 24);
  console.log(JSON.stringify(invalido, null, 2));

  if (
    invalido.status === 400 &&
    invalido.message === 'Marcador inválido: no cierra el set según las reglas configuradas (25 pts, ventaja 2).'
  ) {
    console.log('✓ Marcador inválido 25-24 bloqueado correctamente.');
  } else {
    console.error('✗ Marcador inválido no devolvió el error esperado.');
    process.exitCode = 1;
  }

  await imprimirProgresionFixture(PARTIDO_ID, propagacionFinal);

  console.log('\n=== Fin del script ===');
} catch (error) {
  console.error('Error en test-registrar-set:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
