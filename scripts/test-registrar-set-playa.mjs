import sequelize from '../src/config/database.js';
import {
  Partidos,
  MarcadoresDetalle,
  EventosPartido,
  Torneos
} from '../src/db/db.js';
import { ejecutarInicioPartido } from '../src/controllers/partidosController.js';
import { asegurarNominasValidadasPartido } from './test-helpers-nominas.mjs';
import { ejecutarRegistrarSet } from '../src/controllers/eventosController.js';
import { resolverPuntosPorSet } from '../src/services/reducerPartido.js';

const PARTIDO_ID = 9;
const TORNEO_ID = 3;
const ARBITRO_USER_ID = 1;

const SETS_PLAYA = [
  { label: 'Set 1 (playa 21 pts)', puntos_local: 21, puntos_visitante: 18 },
  { label: 'Set 2 (playa 21 pts)', puntos_local: 18, puntos_visitante: 21 },
  { label: 'Set 3 decisivo (15 pts default)', puntos_local: 15, puntos_visitante: 10 }
];

const resetearEIniciar = async () => {
  await MarcadoresDetalle.destroy({ where: { partido_id: PARTIDO_ID } });
  await EventosPartido.destroy({ where: { partido_id: PARTIDO_ID } });
  await Partidos.update(
    { state: 'PROGRAMADO', arbitro_asignado_id: ARBITRO_USER_ID, equipo_que_saca_inicial: 'local' },
    { where: { id: PARTIDO_ID } }
  );

  await asegurarNominasValidadasPartido(PARTIDO_ID, ARBITRO_USER_ID);
  const inicio = await ejecutarInicioPartido(PARTIDO_ID, ARBITRO_USER_ID);
  if (inicio.status !== 200) {
    throw new Error(`No se pudo iniciar partido ${PARTIDO_ID}: ${inicio.message}`);
  }
};

try {
  console.log('=== test-registrar-set-playa (torneo id=3, partido id=9) ===\n');

  const torneo = await Torneos.findByPk(TORNEO_ID, {
    attributes: ['id', 'nombre', 'reglas_arbitraje_json']
  });

  if (!torneo) {
    throw new Error(`Torneo id=${TORNEO_ID} no existe. Ejecuta test-iniciar-partido.mjs primero.`);
  }

  console.log('Reglas del torneo:', JSON.stringify(torneo.reglas_arbitraje_json));

  const reglas = torneo.reglas_arbitraje_json;
  const puntosSet1 = resolverPuntosPorSet(reglas, 0, 0);
  const puntosSetDecisivo = resolverPuntosPorSet(
    reglas,
    reglas.sets_para_ganar - 1,
    reglas.sets_para_ganar - 1
  );

  console.log(`Puntos set normal (0-0): ${puntosSet1} (esperado: ${reglas.puntos_por_set})`);
  console.log(
    `Puntos set decisivo (${reglas.sets_para_ganar - 1}-${reglas.sets_para_ganar - 1}): ` +
      `${puntosSetDecisivo} (esperado: ${reglas.puntos_set_decisivo ?? 15})`
  );

  await resetearEIniciar();
  console.log(`\nPartido ${PARTIDO_ID} reiniciado e iniciado.\n`);

  for (const set of SETS_PLAYA) {
    console.log(`--- ${set.label}: ${set.puntos_local}-${set.puntos_visitante} ---`);
    const resultado = await ejecutarRegistrarSet(
      PARTIDO_ID,
      ARBITRO_USER_ID,
      set.puntos_local,
      set.puntos_visitante
    );

    if (resultado.status !== 200) {
      console.log(JSON.stringify(resultado, null, 2));
      throw new Error(`Falló registro de ${set.label}`);
    }

    const m = resultado.marcador;
    console.log(
      `  sets ${m.sets_ganados_local}-${m.sets_ganados_visitante}, ` +
        `resultado_principal=${m.resultado_principal}`
    );
    console.log(`  parciales: ${JSON.stringify(m.metrica_estructura.parciales_sets)}`);
  }

  const marcadorFinal = await MarcadoresDetalle.findOne({ where: { partido_id: PARTIDO_ID } });
  const [estadoPartido] = await sequelize.query(
    'SELECT id, state FROM partidos WHERE id = :id',
    { replacements: { id: PARTIDO_ID } }
  );

  console.log('\n--- Resultado final ---');
  console.log('Estado partido:', estadoPartido[0]);
  console.log('resultado_principal:', marcadorFinal.resultado_principal);
  console.log('Parciales:', JSON.stringify(marcadorFinal.metrica_estructura.parciales_sets));

  const parciales = marcadorFinal.metrica_estructura.parciales_sets;
  const set3 = parciales[2];

  if (marcadorFinal.resultado_principal === 1) {
    console.log('✓ Local ganó el partido (resultado_principal = 1)');
  } else {
    console.error(`✗ resultado_principal esperado 1, recibido: ${marcadorFinal.resultado_principal}`);
    process.exitCode = 1;
  }

  if (set3[0] === 15 && set3[1] === 10) {
    console.log('✓ Set decisivo registrado 15-10 (usa puntos_set_decisivo default, no 21)');
  } else {
    console.error(`✗ Set decisivo inesperado: ${JSON.stringify(set3)}`);
    process.exitCode = 1;
  }

  if (estadoPartido[0].state === 'FINALIZADO') {
    console.log('✓ partido.state = FINALIZADO');
  } else {
    console.error(`✗ state esperado FINALIZADO, recibido: ${estadoPartido[0].state}`);
    process.exitCode = 1;
  }

  console.log('\n=== Fin del script playa ===');
} catch (error) {
  console.error('Error:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
