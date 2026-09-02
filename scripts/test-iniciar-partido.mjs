import sequelize from '../src/config/database.js';
import { Partidos, MarcadoresDetalle, Torneos, User, Sports } from '../src/db/db.js';
import { ejecutarInicioPartido, ejecutarDefinirEquipoQueSacaInicial } from '../src/controllers/partidosController.js';
import { asegurarNominasValidadasPartido } from './test-helpers-nominas.mjs';

const TORNEO_ID = 2;
const GRUPO_A_ID = 1;
const ARBITRO_USER_ID = 1;
const TORNEO_PLAYA_NOMBRE = 'TEST_INICIAR_PARTIDO_PLAYA_ZYRA';

const REGLAS_PLAYA = {
  puntos_por_set: 21,
  ventaja_obligatoria: 2,
  sets_para_ganar: 2
};

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

const prepararPartido = async (partidoId) => {
  const partido = await Partidos.findByPk(partidoId, {
    attributes: ['id', 'torneo_id', 'arbitro_asignado_id', 'state']
  });

  if (!partido) {
    throw new Error(`Partido id=${partidoId} no existe.`);
  }

  console.log(`Partido ${partidoId} antes de preparar:`, partido.toJSON());

  const teniaArbitro = partido.arbitro_asignado_id != null;

  await MarcadoresDetalle.destroy({ where: { partido_id: partidoId } });
  await partido.update({
    state: 'PROGRAMADO',
    arbitro_asignado_id: partido.arbitro_asignado_id ?? ARBITRO_USER_ID,
    equipo_que_saca_inicial: null,
  });

  if (teniaArbitro) {
    console.log(`Árbitro ya asignado: user_id=${partido.arbitro_asignado_id}`);
  } else {
    console.log(`Árbitro asignado: user_id=${ARBITRO_USER_ID}`);
  }

  const partidoListo = await Partidos.findByPk(partidoId, {
    attributes: ['id', 'torneo_id', 'arbitro_asignado_id', 'state']
  });

  console.log(`Partido ${partidoId} listo para iniciar:`, partidoListo.toJSON());
  return partidoListo;
};

const imprimirEstadoPartido = async (partidoId) => {
  const [filas] = await sequelize.query(
    'SELECT id, state FROM partidos WHERE id = :partidoId',
    { replacements: { partidoId } }
  );

  console.log(`\n--- SELECT id, state FROM partidos WHERE id = ${partidoId} ---`);
  if (filas.length === 0) {
    console.log('(sin filas)');
    return null;
  }

  console.table(filas);
  return filas[0];
};

const imprimirMarcadoresDetalle = async (partidoId) => {
  const [filas] = await sequelize.query(
    `
    SELECT id, partido_id, resultado_principal, sets_ganados_local, sets_ganados_visitante,
           reglas_arbitraje_snapshot, equipo_que_saca, actualizado_en
    FROM marcadores_detalle
    WHERE partido_id = :partidoId
    `,
    { replacements: { partidoId } }
  );

  console.log('\n--- SELECT marcadores_detalle (partido_id =', partidoId, ') ---');
  if (filas.length === 0) {
    console.log('(sin filas)');
    return null;
  }

  console.table(
    filas.map((fila) => ({
      ...fila,
      reglas_arbitraje_snapshot: JSON.stringify(fila.reglas_arbitraje_snapshot)
    }))
  );

  return filas[0];
};

const obtenerUsuarioYSport = async () => {
  const usuario = await User.findByPk(ARBITRO_USER_ID);
  if (!usuario) {
    throw new Error(`Usuario id=${ARBITRO_USER_ID} no existe.`);
  }

  const sport = await Sports.findOne({ order: [['id', 'ASC']] });
  if (!sport) {
    throw new Error('No hay deportes en la base de datos.');
  }

  return { usuario, sport };
};

const obtenerOCrearTorneoPlaya = async (userId, sportId) => {
  let torneo = await Torneos.findOne({ where: { nombre: TORNEO_PLAYA_NOMBRE } });

  if (!torneo) {
    torneo = await Torneos.create({
      nombre: TORNEO_PLAYA_NOMBRE,
      sport_id: sportId,
      creado_por_user_id: userId,
      reglas_arbitraje_json: REGLAS_PLAYA,
      modalidad: 'playa',
      visibilidad: 'PRIVADO'
    });
    console.log(`Torneo playa creado: id=${torneo.id}`, REGLAS_PLAYA);
  } else {
    await torneo.update({
      reglas_arbitraje_json: REGLAS_PLAYA,
      modalidad: 'playa',
      visibilidad: 'PRIVADO'
    });
    console.log(`Torneo playa reutilizado: id=${torneo.id}`, REGLAS_PLAYA);
  }

  return torneo;
};

const obtenerOCrearPartidoTorneoPlaya = async (torneo) => {
  let partido = await Partidos.findOne({
    where: { torneo_id: torneo.id },
    order: [['id', 'ASC']]
  });

  if (!partido) {
    partido = await Partidos.create({
      torneo_id: torneo.id,
      sport_id: torneo.sport_id,
      state: 'PROGRAMADO',
      nivel_arbitraje: torneo.nivel_arbitraje_default,
      arbitro_asignado_id: ARBITRO_USER_ID
    });
    console.log(`Partido playa creado: id=${partido.id} (torneo_id=${torneo.id})`);
  } else {
    console.log(`Partido playa reutilizado: id=${partido.id} (torneo_id=${torneo.id})`);
  }

  return partido;
};

const verificarSnapshotPlaya = (snapshot) => {
  const reglas = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
  const esperado = REGLAS_PLAYA;
  const coincide =
    reglas.puntos_por_set === esperado.puntos_por_set &&
    reglas.ventaja_obligatoria === esperado.ventaja_obligatoria &&
    reglas.sets_para_ganar === esperado.sets_para_ganar;

  if (coincide) {
    console.log('\n✓ Snapshot playa correcto (21/2/2) — lee torneo.reglas_arbitraje_json, no el default.');
  } else {
    console.error('\n✗ Snapshot playa incorrecto. Esperado 21/2/2, recibido:', reglas);
    console.error('  Posible bug en resolverReglasArbitrajeSnapshot (cae en default).');
    process.exitCode = 1;
  }
};

try {
  console.log('=== test-iniciar-partido ===\n');

  const PARTIDO_ID = await resolverPartidoTorneo2GrupoA();
  console.log(`Usando partido id=${PARTIDO_ID} (torneo_id=${TORNEO_ID}, grupo_id=${GRUPO_A_ID})\n`);

  // --- CASO 1: partido existente ---
  console.log(`--- CASO 1: partido id=${PARTIDO_ID} ---\n`);
  await prepararPartido(PARTIDO_ID);

  console.log(`\n--- Sin saque inicial (debe bloquear): ejecutarInicioPartido(${PARTIDO_ID}, ${ARBITRO_USER_ID}) ---`);
  const sinSaque = await ejecutarInicioPartido(PARTIDO_ID, ARBITRO_USER_ID);
  console.log(JSON.stringify(sinSaque, null, 2));

  if (
    sinSaque.status === 400
    && sinSaque.message === 'Debes indicar qué equipo saca primero antes de iniciar el partido'
  ) {
    console.log('✓ Inicio bloqueado sin definir quién saca primero.');
  } else {
    console.error('✗ Se esperaba bloqueo por saque inicial no definido.');
    process.exitCode = 1;
  }

  console.log(`\n--- Árbitro define visitante como primer saque ---`);
  const definirSaque = await ejecutarDefinirEquipoQueSacaInicial(PARTIDO_ID, ARBITRO_USER_ID, 'visitante');
  console.log(JSON.stringify(definirSaque, null, 2));

  if (definirSaque.status !== 200 || definirSaque.equipo_que_saca_inicial !== 'visitante') {
    console.error('✗ No se pudo definir equipo que saca primero.');
    process.exitCode = 1;
  } else {
    console.log('✓ Saque inicial definido por árbitro (visitante).');
  }

  console.log(`\n--- Primera llamada: ejecutarInicioPartido(${PARTIDO_ID}, ${ARBITRO_USER_ID}) ---`);
  await asegurarNominasValidadasPartido(PARTIDO_ID, ARBITRO_USER_ID);
  const primera = await ejecutarInicioPartido(PARTIDO_ID, ARBITRO_USER_ID);
  console.log(JSON.stringify(primera, null, 2));

  const estadoTrasInicio = await imprimirEstadoPartido(PARTIDO_ID);
  if (estadoTrasInicio?.state === 'EN_CURSO') {
    console.log('✓ partido.state cambió a EN_CURSO.');
  } else {
    console.error(`✗ partido.state esperado EN_CURSO, recibido: ${estadoTrasInicio?.state ?? '(null)'}`);
    process.exitCode = 1;
  }

  const filaMarcador = await imprimirMarcadoresDetalle(PARTIDO_ID);
  if (filaMarcador?.equipo_que_saca === 'visitante') {
    console.log('✓ marcadores_detalle.equipo_que_saca = visitante (elección del árbitro).');
  } else {
    console.error(`✗ equipo_que_saca esperado visitante, recibido: ${filaMarcador?.equipo_que_saca ?? '(null)'}`);
    process.exitCode = 1;
  }

  console.log(`\n--- Segunda llamada (debe bloquear): ejecutarInicioPartido(${PARTIDO_ID}, ${ARBITRO_USER_ID}) ---`);
  const segunda = await ejecutarInicioPartido(PARTIDO_ID, ARBITRO_USER_ID);
  console.log(JSON.stringify(segunda, null, 2));

  if (segunda.status === 400 && segunda.message === 'Este partido ya fue iniciado') {
    console.log('\n✓ Segunda llamada bloqueada correctamente.');
  } else {
    console.error('\n✗ La segunda llamada no devolvió el error esperado.');
    process.exitCode = 1;
  }

  // --- Caso 2: torneo playa con reglas 21/2/2 (distintas al default) ---
  console.log('\n\n--- CASO 2: torneo playa con reglas distintas (21/2/2) ---\n');

  const { usuario, sport } = await obtenerUsuarioYSport();
  const torneoPlaya = await obtenerOCrearTorneoPlaya(usuario.id, sport.id);
  const partidoPlaya = await obtenerOCrearPartidoTorneoPlaya(torneoPlaya);
  await prepararPartido(partidoPlaya.id);

  const saquePlaya = await ejecutarDefinirEquipoQueSacaInicial(partidoPlaya.id, ARBITRO_USER_ID, 'local');
  if (saquePlaya.status !== 200) {
    throw new Error(`No se pudo definir saque playa: ${saquePlaya.message}`);
  }

  console.log(`\n--- Iniciar partido playa: ejecutarInicioPartido(${partidoPlaya.id}, ${ARBITRO_USER_ID}) ---`);
  await asegurarNominasValidadasPartido(partidoPlaya.id, ARBITRO_USER_ID);
  const resultadoPlaya = await ejecutarInicioPartido(partidoPlaya.id, ARBITRO_USER_ID);
  console.log(JSON.stringify(resultadoPlaya, null, 2));

  const filaMarcadorPlaya = await imprimirMarcadoresDetalle(partidoPlaya.id);
  verificarSnapshotPlaya(
    filaMarcadorPlaya?.reglas_arbitraje_snapshot ??
      resultadoPlaya.marcador?.reglas_arbitraje_snapshot
  );

  console.log('\n=== Fin del script ===');
} catch (error) {
  console.error('Error en test-iniciar-partido:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
