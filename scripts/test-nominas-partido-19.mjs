/**
 * Completa nóminas partido #19, valida e intenta iniciar.
 */
import { Op } from 'sequelize';
import sequelize from '../src/config/database.js';
import {
  Partidos,
  PartidoNominas,
  TeamMiembros,
  User
} from '../src/db/db.js';
import {
  asignarArbitroPartido,
  iniciarPartido
} from '../src/controllers/partidosController.js';
import { proponerNomina, validarNomina } from '../src/controllers/nominasController.js';

const PARTIDO_ID = 19;
const TEAM_ANDRES = 13;
const TEAM_ELEMENTALES = 14;
const CAPITAN_ID = 1;
const ORGANIZADOR_ID = 1;
const ARBITRO_ID = 14;

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

const asegurarMiembrosEquipo = async (teamId, userIdsObjetivo) => {
  const ids = [];

  for (const userId of userIdsObjetivo) {
    const existente = await TeamMiembros.findOne({
      where: { team_id: teamId, user_id: userId }
    });

    if (existente) {
      if (existente.estado_invitacion !== 'ACEPTADO') {
        await existente.update({ estado_invitacion: 'ACEPTADO' });
      }
    } else {
      await TeamMiembros.create({
        team_id: teamId,
        user_id: userId,
        rol: 'JUGADOR',
        estado_invitacion: 'ACEPTADO',
        fecha_union: new Date()
      });
    }

    ids.push(userId);
  }

  return ids;
};

const construirJugadores = (userIds) =>
  userIds.map((userId, index) => ({
    user_id: userId,
    dorsal: index + 1,
    rol_nomina: index < 4 ? 'TITULAR' : 'SUPLENTE'
  }));

try {
  console.log('=== Nóminas partido #19 ===\n');

  await PartidoNominas.destroy({ where: { partido_id: PARTIDO_ID } });
  console.log('Nóminas previas del partido 19 eliminadas.\n');

  const partido = await Partidos.findByPk(PARTIDO_ID);
  if (!partido) throw new Error('Partido 19 no encontrado');

  if (!partido.arbitro_asignado_id) {
    console.log('--- PUT asignar árbitro (organizador Andrés → Kevin) ---');
    const asignar = await invocar(asignarArbitroPartido, {
      userId: ORGANIZADOR_ID,
      params: { partido_id: String(PARTIDO_ID) },
      body: { arbitro_asignado_id: ARBITRO_ID }
    });
    console.log(`HTTP ${asignar.statusCode}`, JSON.stringify(asignar.body, null, 2));
  }

  console.log('\n--- Miembros por equipo (disjuntos entre equipos) ---');
  const miembrosAndres = await asegurarMiembrosEquipo(TEAM_ANDRES, [1, 2, 3, 4, 5, 6]);
  const miembrosElementales = await asegurarMiembrosEquipo(TEAM_ELEMENTALES, [7, 8, 9, 10, 11, 12]);
  console.log('Andres Team FC:', miembrosAndres);
  console.log('Elementales Group:', miembrosElementales);

  console.log('\n--- POST nominas (capitán Andrés) ---');
  for (const [teamId, userIds, label] of [
    [TEAM_ANDRES, miembrosAndres, 'Andres Team FC'],
    [TEAM_ELEMENTALES, miembrosElementales, 'Elementales Group']
  ]) {
    const res = await invocar(proponerNomina, {
      userId: CAPITAN_ID,
      params: { partido_id: String(PARTIDO_ID) },
      body: { team_id: teamId, jugadores: construirJugadores(userIds) }
    });
    console.log(`${label} → HTTP ${res.statusCode}`, res.body?.message, `(${res.body?.data?.length ?? 0} jugadores)`);
  }

  console.log('\n--- PUT nominas/validar (árbitro Kevin) ---');
  for (const [teamId, label] of [
    [TEAM_ANDRES, 'Andres Team FC'],
    [TEAM_ELEMENTALES, 'Elementales Group']
  ]) {
    const res = await invocar(validarNomina, {
      userId: ARBITRO_ID,
      params: { partido_id: String(PARTIDO_ID) },
      body: { team_id: teamId, resultado: 'VALIDADO' }
    });
    console.log(`${label} → HTTP ${res.statusCode}`, res.body?.message);
  }

  const pendientes = await PartidoNominas.count({
    where: { partido_id: PARTIDO_ID, estado_validacion: 'PENDIENTE' }
  });
  const validadas = await PartidoNominas.count({
    where: { partido_id: PARTIDO_ID, estado_validacion: 'VALIDADO' }
  });
  console.log(`\nResumen nóminas: ${validadas} VALIDADO, ${pendientes} PENDIENTE`);

  console.log('\n--- POST /api/partidos/19/iniciar (árbitro Kevin) ---');
  const iniciar = await invocar(iniciarPartido, {
    userId: ARBITRO_ID,
    params: { id: String(PARTIDO_ID) }
  });
  console.log(`HTTP ${iniciar.statusCode}`);
  console.log(JSON.stringify(iniciar.body, null, 2));

  const final = await Partidos.findByPk(PARTIDO_ID);
  console.log(`\nEstado final: ${final.state}`);

  if (iniciar.statusCode !== 200) process.exitCode = 1;
  else console.log('\n✓ Partido iniciado correctamente.');
} catch (error) {
  console.error('\nError:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
