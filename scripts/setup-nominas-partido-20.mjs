/**
 * Repone nóminas en partido #20 (torneo TEST_ARBITRAJE_ANDRES_IPHONE).
 * Uso: node scripts/setup-nominas-partido-20.mjs
 */
import sequelize from '../src/config/database.js';
import { Partidos, PartidoNominas, TeamMiembros, MarcadoresDetalle, EventosPartido } from '../src/db/db.js';
import { proponerNomina, validarNomina } from '../src/controllers/nominasController.js';

const PARTIDO_ID = 20;
const TEAM_ANDRES = 13;
const TEAM_ELEMENTALES = 14;
const CAPITAN_ID = 1;
const ARBITRO_ID = 1;

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
        rol: userId === CAPITAN_ID ? 'CAPITAN' : 'JUGADOR',
        estado_invitacion: 'ACEPTADO',
        fecha_union: new Date()
      });
    }
  }
};

const construirJugadores = (userIds) =>
  userIds.map((userId, index) => ({
    user_id: userId,
    dorsal: index + 1,
    rol_nomina: index < 6 ? 'TITULAR' : 'SUPLENTE'
  }));

try {
  console.log('=== Nóminas partido #20 ===\n');

  const partido = await Partidos.findByPk(PARTIDO_ID);
  if (!partido) throw new Error('Partido 20 no encontrado');

  await MarcadoresDetalle.destroy({ where: { partido_id: PARTIDO_ID } });
  await EventosPartido.destroy({ where: { partido_id: PARTIDO_ID } });
  await PartidoNominas.destroy({ where: { partido_id: PARTIDO_ID } });

  await partido.update({
    state: 'PROGRAMADO',
    arbitro_asignado_id: ARBITRO_ID,
    score_local_final: null,
    score_visitante_final: null
  });

  console.log('Partido reseteado a PROGRAMADO.\n');

  const miembrosAndres = [1, 2, 3, 4, 5, 6, 7];
  const miembrosElementales = [8, 9, 10, 11, 12, 13, 14];

  await asegurarMiembrosEquipo(TEAM_ANDRES, miembrosAndres);
  await asegurarMiembrosEquipo(TEAM_ELEMENTALES, miembrosElementales);

  console.log('--- Proponer nóminas (capitán Andrés) ---');
  for (const [teamId, userIds, label] of [
    [TEAM_ANDRES, miembrosAndres, 'Andres Team FC'],
    [TEAM_ELEMENTALES, miembrosElementales, 'Elementales Group']
  ]) {
    const res = await invocar(proponerNomina, {
      userId: CAPITAN_ID,
      params: { partido_id: String(PARTIDO_ID) },
      body: { team_id: teamId, jugadores: construirJugadores(userIds) }
    });
    console.log(
      `${label}: HTTP ${res.statusCode} — ${res.body?.data?.length ?? 0} jugadores`,
      res.statusCode !== 200 && res.statusCode !== 201 ? res.body?.message : ''
    );
  }

  console.log('\n--- Validar nóminas (árbitro Andrés) — opcional, quedan PENDIENTE si falla ---');
  for (const [teamId, label] of [
    [TEAM_ANDRES, 'Andres Team FC'],
    [TEAM_ELEMENTALES, 'Elementales Group']
  ]) {
    const res = await invocar(validarNomina, {
      userId: ARBITRO_ID,
      params: { partido_id: String(PARTIDO_ID) },
      body: { team_id: teamId, resultado: 'VALIDADO' }
    });
    console.log(`${label}: HTTP ${res.statusCode} — ${res.body?.message ?? ''}`);
  }

  const total = await PartidoNominas.count({ where: { partido_id: PARTIDO_ID } });
  const pendientes = await PartidoNominas.count({
    where: { partido_id: PARTIDO_ID, estado_validacion: 'PENDIENTE' }
  });
  const validadas = await PartidoNominas.count({
    where: { partido_id: PARTIDO_ID, estado_validacion: 'VALIDADO' }
  });

  console.log(`\nResumen: ${total} jugadores (${validadas} validados, ${pendientes} pendientes)`);
  console.log('Partido #20 listo en Mis arbitrajes → Andrés.\n');
} catch (error) {
  console.error('Error:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
