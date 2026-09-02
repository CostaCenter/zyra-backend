/**
 * Prueba max_equipos e iniciar torneo.
 * Torneo aislado TEST_MAX_EQUIPOS_ZYRA — se elimina al finalizar.
 */
import sequelize from '../src/config/database.js';
import {
  Torneos,
  FaseTorneo,
  TorneoInscripcion,
  Team,
  Sports,
  MarcadoresDetalle,
  EventosPartido,
  PartidoConfirmaciones,
  PartidoParticipantes,
  PartidoJugadorStats,
  PartidoNominas,
  ProgresionFixture,
  Partidos
} from '../src/db/db.js';
import { createTorneo, iniciarTorneo } from '../src/controllers/torneosController.js';
import {
  invitarInscripcion,
  solicitarInscripcion
} from '../src/controllers/torneoInscripcionesController.js';

const TORNEO_NOMBRE = 'TEST_MAX_EQUIPOS_ZYRA';
const ORGANIZADOR_ID = 14;
const CAPITAN_EXTRA_ID = 1;

const invocar = async (handler, req) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  await handler(req, res);
  return res;
};

const crearEquipoPrueba = async (nombre, sportId, capitanId) => {
  let equipo = await Team.findOne({ where: { name: nombre } });
  if (!equipo) {
    equipo = await Team.create({
      name: nombre,
      sport_id: sportId,
      capitan_id: capitanId
    });
  }
  return equipo;
};

const inscribirAceptada = async (torneoId, teamId, userId) => {
  const existente = await TorneoInscripcion.findOne({
    where: { torneo_id: torneoId, team_id: teamId }
  });

  if (existente) {
    await existente.update({
      estado: 'ACEPTADA',
      resuelto_por_id: ORGANIZADOR_ID,
      resuelto_at: new Date()
    });
    return existente;
  }

  return TorneoInscripcion.create({
    torneo_id: torneoId,
    team_id: teamId,
    origen: 'INVITACION_TORNEO',
    iniciado_por_id: userId,
    estado: 'ACEPTADA',
    resuelto_por_id: ORGANIZADOR_ID,
    resuelto_at: new Date()
  });
};

const limpiarTorneoPrueba = async (torneoId) => {
  const partidos = await Partidos.findAll({ where: { torneo_id: torneoId }, attributes: ['id'] });

  await sequelize.transaction(async (transaction) => {
    for (const { id: partidoId } of partidos) {
      await MarcadoresDetalle.destroy({ where: { partido_id: partidoId }, transaction });
      await EventosPartido.destroy({ where: { partido_id: partidoId }, transaction });
      await PartidoConfirmaciones.destroy({ where: { partido_id: partidoId }, transaction });
      await PartidoParticipantes.destroy({ where: { partido_id: partidoId }, transaction });
      await PartidoJugadorStats.destroy({ where: { partido_id: partidoId }, transaction });
      await PartidoNominas.destroy({ where: { partido_id: partidoId }, transaction });
      await ProgresionFixture.destroy({ where: { partido_origen_id: partidoId }, transaction });
      await ProgresionFixture.destroy({ where: { partido_destino_id: partidoId }, transaction });
    }

    await Partidos.destroy({ where: { torneo_id: torneoId }, transaction });
    await TorneoInscripcion.destroy({ where: { torneo_id: torneoId }, transaction });
    await FaseTorneo.destroy({ where: { torneo_id: torneoId }, transaction });
    await Torneos.destroy({ where: { id: torneoId }, transaction });
  });
};

try {
  console.log('=== test-max-equipos-iniciar-torneo ===\n');

  const sport = await Sports.findOne({ order: [['id', 'ASC']] });
  if (!sport) {
    throw new Error('No hay deportes en la base.');
  }

  const previo = await Torneos.findOne({ where: { nombre: TORNEO_NOMBRE } });
  if (previo) {
    await limpiarTorneoPrueba(previo.id);
  }

  console.log('--- POST crear torneo max_equipos=2 ---');
  const crear = await invocar(createTorneo, {
    userId: ORGANIZADOR_ID,
    body: {
      nombre: TORNEO_NOMBRE,
      sport_id: sport.id,
      visibilidad: 'PRIVADO',
      max_equipos: 2,
      reglas_arbitraje_json: {
        puntos_por_set: 25,
        ventaja_obligatoria: 2,
        sets_para_ganar: 3,
        puntos_set_decisivo: 15
      }
    }
  });
  console.log(`HTTP ${crear.statusCode}`);
  console.log(JSON.stringify({
    id: crear.body?.data?.id,
    max_equipos: crear.body?.data?.max_equipos,
    reglas: crear.body?.data?.reglas_arbitraje_json
  }, null, 2));

  const torneoId = crear.body?.data?.id;
  if (!torneoId) {
    throw new Error('No se pudo crear el torneo de prueba.');
  }

  const team1 = await crearEquipoPrueba(`${TORNEO_NOMBRE}_TEAM_1`, sport.id, ORGANIZADOR_ID);
  const team2 = await crearEquipoPrueba(`${TORNEO_NOMBRE}_TEAM_2`, sport.id, ORGANIZADOR_ID);
  const team3 = await crearEquipoPrueba(`${TORNEO_NOMBRE}_TEAM_3`, sport.id, CAPITAN_EXTRA_ID);

  await inscribirAceptada(torneoId, team1.id, ORGANIZADOR_ID);
  await inscribirAceptada(torneoId, team2.id, ORGANIZADOR_ID);
  console.log('\nInscripciones ACEPTADA: team1 + team2');

  console.log('\n--- POST invitar tercer equipo (debe rechazar) ---');
  const invitarTercero = await invocar(invitarInscripcion, {
    userId: ORGANIZADOR_ID,
    params: { torneo_id: String(torneoId) },
    body: { team_id: team3.id }
  });
  console.log(`HTTP ${invitarTercero.statusCode}`);
  console.log(JSON.stringify(invitarTercero.body, null, 2));

  console.log('\n--- PUT iniciar torneo ---');
  const iniciar = await invocar(iniciarTorneo, {
    userId: ORGANIZADOR_ID,
    params: { torneo_id: String(torneoId) }
  });
  console.log(`HTTP ${iniciar.statusCode}`);
  console.log(JSON.stringify({
    estado: iniciar.body?.data?.estado,
    message: iniciar.body?.message
  }, null, 2));

  console.log('\n--- POST solicitar inscripción tras inicio (debe rechazar) ---');
  const solicitarPostInicio = await invocar(solicitarInscripcion, {
    userId: CAPITAN_EXTRA_ID,
    params: { torneo_id: String(torneoId) },
    body: { team_id: team3.id }
  });
  console.log(`HTTP ${solicitarPostInicio.statusCode}`);
  console.log(JSON.stringify(solicitarPostInicio.body, null, 2));

  const ok =
    invitarTercero.statusCode === 400 &&
    invitarTercero.body?.message === 'El torneo ya alcanzó el máximo de equipos' &&
    iniciar.statusCode === 200 &&
    iniciar.body?.data?.estado === 'EN_CURSO' &&
    solicitarPostInicio.statusCode === 400 &&
    solicitarPostInicio.body?.message === 'El torneo ya inició, no se aceptan más equipos';

  await limpiarTorneoPrueba(torneoId);
  console.log(`\nTorneo de prueba id=${torneoId} eliminado.`);

  if (!ok) {
    throw new Error('Alguna aserción del flujo no pasó.');
  }

  console.log('\n✓ max_equipos e iniciar torneo OK.');
  console.log('=== Fin del script ===');
} catch (error) {
  console.error('\nError:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
