/**
 * Crea torneo de prueba similar al #8 (Andres Team FC vs Elementales Group)
 * con Andrés como árbitro asignado — listo para probar en iPhone/dispositivo real.
 *
 * NO se auto-elimina (persiste para pruebas móviles).
 * Uso: node scripts/setup-torneo-arbitraje-andres.mjs
 */
import sequelize from '../src/config/database.js';
import {
  Torneos,
  FaseTorneo,
  TorneoInscripcion,
  Team,
  Partidos,
  PartidoParticipantes,
  MarcadoresDetalle,
  EventosPartido,
  PartidoNominas,
  ProgresionFixture,
  User,
  TeamMiembros
} from '../src/db/db.js';
import {
  createTorneo,
  createFaseTorneo,
  iniciarTorneo,
  generarFixtureFase
} from '../src/controllers/torneosController.js';
import { asignarArbitroPartido } from '../src/controllers/partidosController.js';
import { proponerNomina, validarNomina } from '../src/controllers/nominasController.js';

const TORNEO_NOMBRE = 'TEST_ARBITRAJE_ANDRES_IPHONE';
const ORGANIZADOR_ID = 1; // Andrés
const ARBITRO_ID = 1; // Andrés arbitra desde su iPhone
const TEAM_ANDRES = 13; // Andres Team FC
const TEAM_ELEMENTALES = 14; // Elementales Group
const SPORT_ID = 2;

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

const limpiarTorneoPrevio = async (torneoId) => {
  const partidos = await Partidos.findAll({ where: { torneo_id: torneoId }, attributes: ['id'] });

  for (const { id: partidoId } of partidos) {
    await MarcadoresDetalle.destroy({ where: { partido_id: partidoId } });
    await EventosPartido.destroy({ where: { partido_id: partidoId } });
    await PartidoNominas.destroy({ where: { partido_id: partidoId } });
    await ProgresionFixture.destroy({ where: { partido_origen_id: partidoId } });
    await ProgresionFixture.destroy({ where: { partido_destino_id: partidoId } });
    await PartidoParticipantes.destroy({ where: { partido_id: partidoId } });
  }

  await Partidos.destroy({ where: { torneo_id: torneoId } });
  await TorneoInscripcion.destroy({ where: { torneo_id: torneoId } });
  await FaseTorneo.destroy({ where: { torneo_id: torneoId } });
  await Torneos.destroy({ where: { id: torneoId } });
};

const resetearPartidoProgramado = async (partidoId) => {
  await MarcadoresDetalle.destroy({ where: { partido_id: partidoId } });
  await EventosPartido.destroy({ where: { partido_id: partidoId } });
  await PartidoNominas.destroy({ where: { partido_id: partidoId } });

  await Partidos.update(
    {
      state: 'PROGRAMADO',
      arbitro_asignado_id: ARBITRO_ID,
      score_local_final: null,
      score_visitante_final: null
    },
    { where: { id: partidoId } }
  );
};

const inscribirEquipo = async (torneoId, teamId) => {
  const existente = await TorneoInscripcion.findOne({
    where: { torneo_id: torneoId, team_id: teamId }
  });

  if (existente) {
    await existente.update({
      estado: 'ACEPTADA',
      resuelto_por_id: ORGANIZADOR_ID,
      resuelto_at: new Date()
    });
    return;
  }

  await TorneoInscripcion.create({
    torneo_id: torneoId,
    team_id: teamId,
    origen: 'INVITACION_TORNEO',
    iniciado_por_id: ORGANIZADOR_ID,
    estado: 'ACEPTADA',
    resuelto_por_id: ORGANIZADOR_ID,
    resuelto_at: new Date()
  });
};

const asegurarMiembrosEquipo = async (teamId, userIds) => {
  for (const userId of userIds) {
    const existente = await TeamMiembros.findOne({ where: { team_id: teamId, user_id: userId } });
    if (existente) {
      if (existente.estado_invitacion !== 'ACEPTADO') {
        await existente.update({ estado_invitacion: 'ACEPTADO' });
      }
    } else {
      await TeamMiembros.create({
        team_id: teamId,
        user_id: userId,
        rol: userId === ORGANIZADOR_ID ? 'CAPITAN' : 'JUGADOR',
        estado_invitacion: 'ACEPTADO',
        fecha_union: new Date()
      });
    }
  }
};

const construirJugadoresNomina = (userIds) =>
  userIds.map((userId, index) => ({
    user_id: userId,
    dorsal: index + 1,
    rol_nomina: index < 6 ? 'TITULAR' : 'SUPLENTE'
  }));

const poblarNominasPartido = async (partidoId) => {
  const miembrosAndres = [1, 2, 3, 4, 5, 6, 7];
  const miembrosElementales = [8, 9, 10, 11, 12, 13, 14];

  await asegurarMiembrosEquipo(TEAM_ANDRES, miembrosAndres);
  await asegurarMiembrosEquipo(TEAM_ELEMENTALES, miembrosElementales);

  for (const [teamId, userIds, label] of [
    [TEAM_ANDRES, miembrosAndres, 'Andres Team FC'],
    [TEAM_ELEMENTALES, miembrosElementales, 'Elementales Group']
  ]) {
    const res = await invocar(proponerNomina, {
      userId: ORGANIZADOR_ID,
      params: { partido_id: String(partidoId) },
      body: { team_id: teamId, jugadores: construirJugadoresNomina(userIds) }
    });
    console.log(`Nómina ${label}: ${res.body?.data?.length ?? 0} jugadores`);
  }

  for (const teamId of [TEAM_ANDRES, TEAM_ELEMENTALES]) {
    await invocar(validarNomina, {
      userId: ARBITRO_ID,
      params: { partido_id: String(partidoId) },
      body: { team_id: teamId, resultado: 'VALIDADO' }
    });
  }
};

try {
  console.log('=== setup-torneo-arbitraje-andres ===\n');

  const andres = await User.findByPk(ORGANIZADOR_ID, { attributes: ['id', 'name', 'nick'] });
  const teamLocal = await Team.findByPk(TEAM_ANDRES, { attributes: ['id', 'name', 'sport_id'] });
  const teamVisitante = await Team.findByPk(TEAM_ELEMENTALES, { attributes: ['id', 'name', 'sport_id'] });

  if (!andres || !teamLocal || !teamVisitante) {
    throw new Error('Faltan usuario Andrés o equipos 13/14 en la base de datos.');
  }

  if (teamLocal.sport_id !== SPORT_ID || teamVisitante.sport_id !== SPORT_ID) {
    throw new Error('Los equipos deben ser del mismo deporte (sport_id=2).');
  }

  const previo = await Torneos.findOne({ where: { nombre: TORNEO_NOMBRE } });
  if (previo) {
    console.log(`Eliminando torneo previo id=${previo.id}...`);
    await limpiarTorneoPrevio(previo.id);
  }

  console.log('--- Crear torneo ---');
  const crear = await invocar(createTorneo, {
    userId: ORGANIZADOR_ID,
    body: {
      nombre: TORNEO_NOMBRE,
      sport_id: SPORT_ID,
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

  if (crear.statusCode !== 201 && crear.statusCode !== 200) {
    throw new Error(`No se pudo crear torneo: ${crear.body?.message}`);
  }

  const torneoId = crear.body?.data?.id;
  console.log(`Torneo creado: id=${torneoId} (${TORNEO_NOMBRE})`);

  await inscribirEquipo(torneoId, TEAM_ANDRES);
  await inscribirEquipo(torneoId, TEAM_ELEMENTALES);
  console.log(`Inscritos: ${teamLocal.name} (#${TEAM_ANDRES}) y ${teamVisitante.name} (#${TEAM_ELEMENTALES})`);

  console.log('\n--- Crear fase ---');
  const faseRes = await invocar(createFaseTorneo, {
    userId: ORGANIZADOR_ID,
    params: { torneo_id: String(torneoId) },
    body: {
      nombre: 'Fase todos contra todos',
      orden: 1,
      tipo_formato: 'TODOS_CONTRA_TODOS'
    }
  });

  if (faseRes.statusCode !== 201 && faseRes.statusCode !== 200) {
    throw new Error(`No se pudo crear fase: ${faseRes.body?.message}`);
  }

  const faseId = faseRes.body?.data?.id;
  console.log(`Fase creada: id=${faseId}`);

  console.log('\n--- Iniciar torneo ---');
  const iniciar = await invocar(iniciarTorneo, {
    userId: ORGANIZADOR_ID,
    params: { torneo_id: String(torneoId) }
  });
  console.log(`HTTP ${iniciar.statusCode}: ${iniciar.body?.message}`);

  console.log('\n--- Generar fixture ---');
  const fixture = await invocar(generarFixtureFase, {
    userId: ORGANIZADOR_ID,
    params: { torneo_id: String(torneoId), fase_id: String(faseId) },
    body: {}
  });

  if (fixture.statusCode !== 201 && fixture.statusCode !== 200) {
    throw new Error(`No se pudo generar fixture: ${fixture.body?.message}`);
  }

  const partido = await Partidos.findOne({
    where: { torneo_id: torneoId },
    order: [['id', 'ASC']]
  });

  if (!partido) {
    throw new Error('No se generó ningún partido.');
  }

  console.log('\n--- Asignar árbitro Andrés ---');
  const asignar = await invocar(asignarArbitroPartido, {
    userId: ORGANIZADOR_ID,
    params: { partido_id: String(partido.id) },
    body: { arbitro_asignado_id: ARBITRO_ID }
  });
  console.log(`HTTP ${asignar.statusCode}: ${asignar.body?.message}`);

  await resetearPartidoProgramado(partido.id);

  console.log('\n--- Nóminas (6 titulares + suplentes por equipo) ---');
  await poblarNominasPartido(partido.id);

  const totalNominas = await PartidoNominas.count({ where: { partido_id: partido.id } });

  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partido.id },
    include: [{ association: 'equipo', attributes: ['id', 'name'] }]
  });

  const local = participantes.find((p) => p.es_local);
  const visitante = participantes.find((p) => !p.es_local);

  console.log('\n========================================');
  console.log('  TORNEO LISTO PARA IPHONE / MÓVIL');
  console.log('========================================');
  console.log(`Torneo:  #${torneoId} — ${TORNEO_NOMBRE}`);
  console.log(`Partido: #${partido.id} — ${local?.equipo?.name ?? '?'} vs ${visitante?.equipo?.name ?? '?'}`);
  console.log(`Estado:  PROGRAMADO · ${totalNominas} jugadores en nómina (validados)`);
  console.log(`Árbitro: Andrés (user_id=${ARBITRO_ID}, nick="${andres.nick}")`);
  console.log('\nEn el iPhone:');
  console.log('  1. Login como Andrés');
  console.log('  2. Perfil → Mis arbitrajes');
  console.log('  3. Toca el partido → iniciar → marcador en vivo');
  console.log('\nAsegúrate de que API_BASE_URL en appZyra apunte a la IP de tu PC en la red local.');
  console.log('========================================\n');
} catch (error) {
  console.error('\nError:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
