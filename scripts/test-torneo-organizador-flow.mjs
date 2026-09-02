/**
 * Flujo organizador: crear fase → generar fixture → asignar árbitro.
 * Usa torneo de prueba aislado (TEST_ORGANIZADOR_PANEL_ZYRA) y lo elimina al final.
 * No tocar torneos reales. Ver reglas en scripts/README.md.
 */
import { Op } from 'sequelize';
import sequelize from '../src/config/database.js';
import {
  Torneos,
  FaseTorneo,
  Partidos,
  TorneoInscripcion,
  Team,
  User,
  Sports,
  MarcadoresDetalle,
  EventosPartido,
  PartidoConfirmaciones,
  PartidoParticipantes,
  PartidoJugadorStats,
  PartidoNominas,
  ProgresionFixture
} from '../src/db/db.js';
import { createFaseTorneo, generarFixtureFase, getTorneoById } from '../src/controllers/torneosController.js';
import { asignarArbitroPartido } from '../src/controllers/partidosController.js';

const TORNEO_NOMBRE = 'TEST_ORGANIZADOR_PANEL_ZYRA';
const ORGANIZADOR_USER_ID = 14;

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

const obtenerSport = async () => {
  const sport = await Sports.findOne({ order: [['id', 'ASC']] });
  if (!sport) {
    throw new Error('No hay deportes en la base de datos.');
  }
  return sport;
};

const crearTorneoPrueba = async (sportId) => {
  const torneo = await Torneos.create({
    nombre: TORNEO_NOMBRE,
    sport_id: sportId,
    creado_por_user_id: ORGANIZADOR_USER_ID,
    reglas_arbitraje_json: {},
    visibilidad: 'PRIVADO'
  });
  console.log(`Torneo de prueba creado: id=${torneo.id}, nombre="${torneo.nombre}"`);
  return torneo;
};

const asegurarEquiposEInscripciones = async (torneoId, sportId, minimo = 2) => {
  const actuales = await TorneoInscripcion.count({
    where: { torneo_id: torneoId, estado: 'ACEPTADA' }
  });

  if (actuales >= minimo) {
    console.log(`Inscripciones ACEPTADA existentes: ${actuales}`);
    return;
  }

  for (let i = 1; i <= minimo; i += 1) {
    const nombreEquipo = `${TORNEO_NOMBRE}_TEAM_${i}`;
    let equipo = await Team.findOne({ where: { name: nombreEquipo } });

    if (!equipo) {
      equipo = await Team.create({
        name: nombreEquipo,
        sport_id: sportId,
        capitan_id: ORGANIZADOR_USER_ID
      });
      console.log(`Equipo creado: id=${equipo.id} (${nombreEquipo})`);
    }

    const existente = await TorneoInscripcion.findOne({
      where: { torneo_id: torneoId, team_id: equipo.id }
    });

    if (!existente) {
      await TorneoInscripcion.create({
        torneo_id: torneoId,
        team_id: equipo.id,
        origen: 'INVITACION_TORNEO',
        iniciado_por_id: ORGANIZADOR_USER_ID,
        estado: 'ACEPTADA',
        resuelto_por_id: ORGANIZADOR_USER_ID,
        resuelto_at: new Date()
      });
      console.log(`Inscripción ACEPTADA: team_id=${equipo.id}`);
    }
  }
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

  console.log(`Torneo de prueba id=${torneoId} eliminado al finalizar.`);
};

try {
  console.log('=== test-torneo-organizador-flow ===\n');

  const sport = await obtenerSport();
  const torneo = await crearTorneoPrueba(sport.id);
  const TORNEO_ID = torneo.id;

  let fases = await FaseTorneo.findAll({ where: { torneo_id: TORNEO_ID }, order: [['orden', 'ASC']] });

  if (fases.length === 0) {
    console.log('--- POST crear fase ---');
    const crearFase = await invocar(createFaseTorneo, {
      userId: ORGANIZADOR_USER_ID,
      params: { torneo_id: String(TORNEO_ID) },
      body: {
        nombre: 'Fase de prueba',
        orden: 1,
        tipo_formato: 'TODOS_CONTRA_TODOS'
      }
    });
    console.log(`HTTP ${crearFase.statusCode}`);
    console.log(JSON.stringify(crearFase.body, null, 2));
    fases = await FaseTorneo.findAll({ where: { torneo_id: TORNEO_ID }, order: [['orden', 'ASC']] });
  }

  await asegurarEquiposEInscripciones(TORNEO_ID, sport.id, 2);

  console.log('\n--- POST generar fixture ---');
  const fixture = await invocar(generarFixtureFase, {
    userId: ORGANIZADOR_USER_ID,
    params: {
      torneo_id: String(TORNEO_ID),
      fase_id: String(fases[0].id)
    },
    body: {}
  });
  console.log(`HTTP ${fixture.statusCode}`);
  console.log(JSON.stringify(fixture.body, null, 2));

  const partidoSinArbitro = await Partidos.findOne({
    where: { torneo_id: TORNEO_ID, arbitro_asignado_id: null },
    order: [['id', 'ASC']]
  });

  if (!partidoSinArbitro) {
    throw new Error('No hay partidos sin árbitro para probar la asignación.');
  }

  const arbitro = await User.findOne({
    where: { id: { [Op.ne]: ORGANIZADOR_USER_ID } },
    order: [['id', 'ASC']]
  });

  console.log('\n--- PUT asignar árbitro ---');
  console.log(`Partido id=${partidoSinArbitro.id} → árbitro id=${arbitro.id} (${arbitro.nick})`);

  const asignar = await invocar(asignarArbitroPartido, {
    userId: ORGANIZADOR_USER_ID,
    params: { partido_id: String(partidoSinArbitro.id) },
    body: { arbitro_asignado_id: arbitro.id }
  });
  console.log(`HTTP ${asignar.statusCode}`);
  console.log(JSON.stringify(asignar.body, null, 2));

  console.log('\n--- GET detalle torneo (organizador) ---');
  const detalle = await invocar(getTorneoById, {
    userId: ORGANIZADOR_USER_ID,
    params: { torneo_id: String(TORNEO_ID) }
  });
  console.log(`HTTP ${detalle.statusCode}`);
  console.log(
    JSON.stringify(
      {
        fases: detalle.body?.data?.fases?.map((f) => ({ id: f.id, nombre: f.nombre, orden: f.orden })),
        equipos_inscritos: detalle.body?.data?.equipos_inscritos,
        partidos: detalle.body?.data?.partidos?.map((p) => ({
          id: p.id,
          fase_torneo_id: p.fase_torneo_id,
          arbitro: p.arbitro?.nick ?? null
        }))
      },
      null,
      2
    )
  );

  await limpiarTorneoPrueba(TORNEO_ID);

  console.log('\n✓ Flujo organizador completado (torneo de prueba aislado).');
  console.log('=== Fin del script ===');
} catch (error) {
  console.error('\nError en test-torneo-organizador-flow:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
