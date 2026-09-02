/**
 * Partido de vóley listo para que Kevin arbitre desde el móvil.
 * Estado PROGRAMADO, nóminas validadas — Kevin puede iniciar y puntuar.
 *
 * Uso: node scripts/setup-partido-arbitraje-kevin.mjs
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
  TeamMiembros,
} from '../src/db/db.js';
import {
  createTorneo,
  createFaseTorneo,
  iniciarTorneo,
  generarFixtureFase,
} from '../src/controllers/torneosController.js';
import { asignarArbitroPartido } from '../src/controllers/partidosController.js';
import { proponerNomina, validarNomina } from '../src/controllers/nominasController.js';

const TORNEO_NOMBRE = 'TEST_ARBITRAJE_KEVIN_DEMO';
const ORGANIZADOR_ID = 1;
const ARBITRO_ID = 14; // Kevin (dispositivo móvil)
const TEAM_LOCAL = 13; // Andres Team FC
const TEAM_VISITANTE = 12; // KABO CLUB
const SPORT_ID = 2; // Vóley

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
    },
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
      score_visitante_final: null,
      datetime: new Date(Date.now() + 30 * 60 * 1000),
    },
    { where: { id: partidoId } }
  );
};

const inscribirEquipo = async (torneoId, teamId) => {
  const existente = await TorneoInscripcion.findOne({
    where: { torneo_id: torneoId, team_id: teamId },
  });

  if (existente) {
    await existente.update({
      estado: 'ACEPTADA',
      resuelto_por_id: ORGANIZADOR_ID,
      resuelto_at: new Date(),
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
    resuelto_at: new Date(),
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
        fecha_union: new Date(),
      });
    }
  }
};

const construirJugadoresNomina = (userIds) =>
  userIds.map((userId, index) => ({
    user_id: userId,
    dorsal: index + 1,
    rol_nomina: index < 6 ? 'TITULAR' : 'SUPLENTE',
  }));

const poblarNominasPartido = async (partidoId) => {
  const miembrosLocal = [1, 2, 3, 4, 5, 6, 7];
  // Kevin (14) es capitán pero árbitro — no va en la nómina; se agregan jugadores seed al equipo
  const miembrosVisitante = [8, 9, 10, 11, 135, 136, 137];

  await asegurarMiembrosEquipo(TEAM_LOCAL, miembrosLocal);
  await asegurarMiembrosEquipo(TEAM_VISITANTE, miembrosVisitante);

  for (const [teamId, userIds, proponenteId, label] of [
    [TEAM_LOCAL, miembrosLocal, ORGANIZADOR_ID, 'local'],
    [TEAM_VISITANTE, miembrosVisitante, ARBITRO_ID, 'visitante'],
  ]) {
    const res = await invocar(proponerNomina, {
      userId: proponenteId,
      params: { partido_id: String(partidoId) },
      body: { team_id: teamId, jugadores: construirJugadoresNomina(userIds) },
    });
    if (res.statusCode >= 400) {
      throw new Error(`Nómina ${label}: ${res.body?.message ?? res.statusCode}`);
    }
    console.log(`Nómina ${label}: HTTP ${res.statusCode} — ${res.body?.data?.length ?? 0} jugadores`);
  }

  for (const teamId of [TEAM_LOCAL, TEAM_VISITANTE]) {
    const res = await invocar(validarNomina, {
      userId: ARBITRO_ID,
      params: { partido_id: String(partidoId) },
      body: { team_id: teamId, resultado: 'VALIDADO' },
    });
    console.log(`Validar team ${teamId}: HTTP ${res.statusCode}`);
  }
};

try {
  console.log('=== setup-partido-arbitraje-kevin ===\n');

  const kevin = await User.findByPk(ARBITRO_ID, { attributes: ['id', 'name', 'nick', 'telefono'] });
  const teamLocal = await Team.findByPk(TEAM_LOCAL, { attributes: ['id', 'name', 'sport_id'] });
  const teamVisitante = await Team.findByPk(TEAM_VISITANTE, { attributes: ['id', 'name', 'sport_id'] });

  if (!kevin) throw new Error(`Usuario Kevin (id=${ARBITRO_ID}) no encontrado.`);
  if (!teamLocal || !teamVisitante) {
    throw new Error(`Equipos ${TEAM_LOCAL}/${TEAM_VISITANTE} no encontrados.`);
  }

  const previo = await Torneos.findOne({ where: { nombre: TORNEO_NOMBRE } });
  if (previo) {
    console.log(`Eliminando torneo previo id=${previo.id}...`);
    await limpiarTorneoPrevio(previo.id);
  }

  console.log('--- Crear torneo vóley ---');
  const crear = await invocar(createTorneo, {
    userId: ORGANIZADOR_ID,
    body: {
      nombre: TORNEO_NOMBRE,
      sport_id: SPORT_ID,
      visibilidad: 'PRIVADO',
      max_equipos: 2,
      modalidad: 'playa',
      reglas_arbitraje_json: {
        puntos_por_set: 25,
        ventaja_obligatoria: 2,
        sets_para_ganar: 3,
        puntos_set_decisivo: 15,
      },
    },
  });

  if (crear.statusCode !== 201 && crear.statusCode !== 200) {
    throw new Error(`No se pudo crear torneo: ${crear.body?.message}`);
  }

  const torneoId = crear.body?.data?.id;
  console.log(`Torneo creado: id=${torneoId}`);

  await inscribirEquipo(torneoId, TEAM_LOCAL);
  await inscribirEquipo(torneoId, TEAM_VISITANTE);
  console.log(`Inscritos: ${teamLocal.name} vs ${teamVisitante.name}`);

  const faseRes = await invocar(createFaseTorneo, {
    userId: ORGANIZADOR_ID,
    params: { torneo_id: String(torneoId) },
    body: { nombre: 'Fase única', orden: 1, tipo_formato: 'TODOS_CONTRA_TODOS' },
  });

  const faseId = faseRes.body?.data?.id;
  if (!faseId) throw new Error(`No se pudo crear fase: ${faseRes.body?.message}`);

  await invocar(iniciarTorneo, {
    userId: ORGANIZADOR_ID,
    params: { torneo_id: String(torneoId) },
  });

  const fixture = await invocar(generarFixtureFase, {
    userId: ORGANIZADOR_ID,
    params: { torneo_id: String(torneoId), fase_id: String(faseId) },
    body: {},
  });

  if (fixture.statusCode !== 201 && fixture.statusCode !== 200) {
    throw new Error(`No se pudo generar fixture: ${fixture.body?.message}`);
  }

  const partido = await Partidos.findOne({
    where: { torneo_id: torneoId },
    order: [['id', 'ASC']],
  });

  if (!partido) throw new Error('No se generó ningún partido.');

  const asignar = await invocar(asignarArbitroPartido, {
    userId: ORGANIZADOR_ID,
    params: { partido_id: String(partido.id) },
    body: { arbitro_asignado_id: ARBITRO_ID },
  });
  console.log(`Asignar árbitro: HTTP ${asignar.statusCode} — ${asignar.body?.message ?? ''}`);

  await resetearPartidoProgramado(partido.id);
  await poblarNominasPartido(partido.id);

  const totalNominas = await PartidoNominas.count({ where: { partido_id: partido.id } });
  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partido.id },
    include: [{ association: 'equipo', attributes: ['id', 'name'] }],
  });
  const local = participantes.find((p) => p.es_local);
  const visitante = participantes.find((p) => !p.es_local);

  console.log('\n========================================');
  console.log('  PARTIDO LISTO — KEVIN ÁRBITRO');
  console.log('========================================');
  console.log(`Torneo:  #${torneoId} — ${TORNEO_NOMBRE}`);
  console.log(`Partido: #${partido.id} — ${local?.equipo?.name ?? '?'} vs ${visitante?.equipo?.name ?? '?'}`);
  console.log(`Deporte: Vóley (sport_id=${SPORT_ID})`);
  console.log(`Estado:  PROGRAMADO · ${totalNominas} jugadores en nómina (validados)`);
  console.log(`Árbitro: ${kevin.name} (user_id=${ARBITRO_ID}, tel ${kevin.telefono ?? '—'})`);
  console.log('\nEn el móvil (login como Kevin):');
  console.log('  Perfil → Mis arbitrajes → abrir partido → Iniciar → marcar puntos');
  console.log('========================================\n');
} catch (error) {
  console.error('\nError:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
