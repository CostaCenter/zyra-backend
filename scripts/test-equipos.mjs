import { Op } from 'sequelize';
import sequelize from '../src/config/database.js';
import {
  User,
  Sports,
  Team,
  TeamMiembros,
  DataTeam,
  Torneos,
  Partidos,
  PartidoParticipantes,
  PartidoNominas
} from '../src/db/db.js';
import {
  createTeam,
  getTeamById,
  invitarMiembroEquipo,
  responderInvitacionEquipo
} from '../src/controllers/teamsController.js';
import { buscarUsuariosPorNick } from '../src/controllers/usuariosController.js';
import { proponerNomina } from '../src/controllers/nominasController.js';

const CAPITAN_USER_ID = 1;
let teamId = null;
let partidoId = null;
let torneoId = null;

const crearMockRes = () => {
  const res = {
    statusCode: 200,
    body: null
  };

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    res.body = payload;
    return res;
  };

  return res;
};

const invocarController = async (handler, req) => {
  const res = crearMockRes();
  await handler(req, res);
  return res;
};

const limpiarPartidoPrueba = async (idPartido) => {
  if (!idPartido) return;
  await PartidoNominas.destroy({ where: { partido_id: idPartido } });
  await PartidoParticipantes.destroy({ where: { partido_id: idPartido } });
  await Partidos.destroy({ where: { id: idPartido } });
};

const limpiarEquipoPrueba = async (idEquipo) => {
  if (!idEquipo) return;
  await TeamMiembros.destroy({ where: { team_id: idEquipo } });
  await DataTeam.destroy({ where: { team_id: idEquipo } });
  await Team.destroy({ where: { id: idEquipo } });
};

const obtenerUsuariosPrueba = async (capitanId, minimo = 4) => {
  const usuarios = await User.findAll({
    where: {
      nick: { [Op.ne]: null },
      id: { [Op.ne]: capitanId }
    },
    order: [['id', 'ASC']],
    limit: minimo
  });

  if (usuarios.length < minimo) {
    throw new Error(`Se necesitan al menos ${minimo} usuarios con nick además del capitán.`);
  }

  return usuarios;
};

try {
  console.log('=== test-equipos ===\n');

  const capitan = await User.findByPk(CAPITAN_USER_ID);
  if (!capitan) {
    throw new Error(`Usuario capitán id=${CAPITAN_USER_ID} no existe.`);
  }

  const [invitadoAceptado, invitadoRechazado, invitadoPendiente] =
    await obtenerUsuariosPrueba(capitan.id, 3);

  const deporte = await Sports.findOne({ order: [['id', 'ASC']] });
  if (!deporte) {
    throw new Error('No hay deportes en la base de datos.');
  }

  console.log(`Capitán: id=${capitan.id}, nick=${capitan.nick ?? '(sin nick)'}`);
  console.log(`Invitado (aceptará): id=${invitadoAceptado.id}, nick=${invitadoAceptado.nick}`);
  console.log(`Invitado (rechazará): id=${invitadoRechazado.id}, nick=${invitadoRechazado.nick}`);
  console.log(`Invitado (quedará PENDIENTE): id=${invitadoPendiente.id}, nick=${invitadoPendiente.nick}`);
  console.log(`Deporte: id=${deporte.id}, name=${deporte.name}\n`);

  const nombreEquipo = `TEST_EQUIPOS_${Date.now()}`;

  console.log('=== CASO 1: Crear equipo, buscar nick, invitar y aceptar ===\n');

  console.log('--- POST /api/teams (crear equipo) ---');
  const crear = await invocarController(createTeam, {
    userId: capitan.id,
    body: {
      name: nombreEquipo,
      sport_id: deporte.id,
      privado: false
    }
  });
  console.log(`HTTP ${crear.statusCode}`);
  console.log(JSON.stringify(crear.body, null, 2));

  if (crear.statusCode !== 201) {
    throw new Error('No se pudo crear el equipo de prueba.');
  }

  teamId = crear.body.data.id;

  console.log('\n--- GET /api/usuarios/buscar?nick=... ---');
  const fragmentoNick = invitadoAceptado.nick.slice(0, Math.max(2, invitadoAceptado.nick.length - 1));
  const busqueda = await invocarController(buscarUsuariosPorNick, {
    userId: capitan.id,
    query: { nick: fragmentoNick }
  });
  console.log(`HTTP ${busqueda.statusCode}`);
  console.log(JSON.stringify(busqueda.body, null, 2));

  console.log('\n--- POST /api/teams/:team_id/invitar (usuario que aceptará) ---');
  const invitarAceptado = await invocarController(invitarMiembroEquipo, {
    userId: capitan.id,
    params: { team_id: String(teamId) },
    body: { user_id: invitadoAceptado.id }
  });
  console.log(`HTTP ${invitarAceptado.statusCode}`);
  console.log(JSON.stringify(invitarAceptado.body, null, 2));

  const miembroAceptadoId = invitarAceptado.body.data.id;

  console.log('\n--- PUT .../responder (ACEPTADO) ---');
  const responderAceptado = await invocarController(responderInvitacionEquipo, {
    userId: invitadoAceptado.id,
    params: {
      team_id: String(teamId),
      miembro_id: String(miembroAceptadoId)
    },
    body: { respuesta: 'ACEPTADO' }
  });
  console.log(`HTTP ${responderAceptado.statusCode}`);
  console.log(JSON.stringify(responderAceptado.body, null, 2));

  console.log('\n=== CASO 2: Tercer usuario rechaza la invitación ===\n');

  console.log('--- POST /api/teams/:team_id/invitar (usuario que rechazará) ---');
  const invitarRechazado = await invocarController(invitarMiembroEquipo, {
    userId: capitan.id,
    params: { team_id: String(teamId) },
    body: { user_id: invitadoRechazado.id }
  });
  console.log(`HTTP ${invitarRechazado.statusCode}`);
  console.log(JSON.stringify(invitarRechazado.body, null, 2));

  const miembroRechazadoId = invitarRechazado.body.data.id;

  console.log('\n--- PUT .../responder (RECHAZADO) ---');
  const responderRechazado = await invocarController(responderInvitacionEquipo, {
    userId: invitadoRechazado.id,
    params: {
      team_id: String(teamId),
      miembro_id: String(miembroRechazadoId)
    },
    body: { respuesta: 'RECHAZADO' }
  });
  console.log(`HTTP ${responderRechazado.statusCode}`);
  console.log(JSON.stringify(responderRechazado.body, null, 2));

  if (responderRechazado.body?.data?.estado_invitacion !== 'RECHAZADO') {
    throw new Error('La invitación rechazada no quedó en estado RECHAZADO.');
  }

  console.log('\n--- POST /api/teams/:team_id/invitar (usuario que quedará PENDIENTE) ---');
  const invitarPendiente = await invocarController(invitarMiembroEquipo, {
    userId: capitan.id,
    params: { team_id: String(teamId) },
    body: { user_id: invitadoPendiente.id }
  });
  console.log(`HTTP ${invitarPendiente.statusCode}`);
  console.log(JSON.stringify(invitarPendiente.body, null, 2));

  console.log('\n--- GET /api/teams/:team_id (detalle con ACEPTADO + RECHAZADO + PENDIENTE) ---');
  const detalleConRechazo = await invocarController(getTeamById, {
    userId: capitan.id,
    params: { team_id: String(teamId) }
  });
  console.log(`HTTP ${detalleConRechazo.statusCode}`);
  console.log(JSON.stringify(detalleConRechazo.body, null, 2));

  const miembrosDetalle = detalleConRechazo.body?.data?.miembros ?? [];
  const estadoRechazado = miembrosDetalle.find((m) => m.user_id === invitadoRechazado.id);
  const estadoPendiente = miembrosDetalle.find((m) => m.user_id === invitadoPendiente.id);
  const estadoAceptado = miembrosDetalle.find((m) => m.user_id === invitadoAceptado.id);

  if (estadoRechazado?.estado_invitacion !== 'RECHAZADO') {
    throw new Error('El tercer usuario no aparece como RECHAZADO en el detalle del equipo.');
  }

  if (estadoPendiente?.estado_invitacion !== 'PENDIENTE') {
    throw new Error('El cuarto usuario no aparece como PENDIENTE en el detalle del equipo.');
  }

  if (estadoAceptado?.estado_invitacion !== 'ACEPTADO') {
    throw new Error('El jugador aceptado no aparece como ACEPTADO en el detalle del equipo.');
  }

  console.log('\n✓ Caso 2 verificado: RECHAZADO y PENDIENTE visibles en el detalle del equipo.');

  console.log('\n=== CASO 3: Validación de nóminas por estado_invitacion ===\n');

  const torneo = await Torneos.create({
    sport_id: deporte.id,
    nombre: `TEST_EQUIPOS_TORNEO_${Date.now()}`,
    creado_por_user_id: capitan.id,
    reglas_arbitraje_json: {},
    visibilidad: 'PRIVADO',
    estado: 'EN_CURSO'
  });
  torneoId = torneo.id;

  const partido = await Partidos.create({
    name: `TEST_PARTIDO_${Date.now()}`,
    sport_id: deporte.id,
    torneo_id: torneoId,
    state: 'PROGRAMADO',
    tipo: 'OFICIAL'
  });
  partidoId = partido.id;

  await PartidoParticipantes.create({
    partido_id: partidoId,
    team_id: teamId,
    es_local: true
  });

  console.log(`Partido de torneo creado: id=${partidoId}, torneo_id=${torneoId}, team_id=${teamId}\n`);

  console.log('--- POST /api/partidos/:partido_id/nominas (jugador PENDIENTE → debe fallar) ---');
  const nominaPendiente = await invocarController(proponerNomina, {
    userId: capitan.id,
    params: { partido_id: String(partidoId) },
    body: {
      team_id: teamId,
      jugadores: [
        {
          user_id: invitadoPendiente.id,
          dorsal: 7,
          rol_nomina: 'TITULAR'
        }
      ]
    }
  });
  console.log(`HTTP ${nominaPendiente.statusCode}`);
  console.log(JSON.stringify(nominaPendiente.body, null, 2));

  if (nominaPendiente.statusCode !== 400) {
    throw new Error('Se esperaba HTTP 400 al proponer nómina con jugador PENDIENTE.');
  }

  console.log('\n--- POST /api/partidos/:partido_id/nominas (jugador RECHAZADO → debe fallar) ---');
  const nominaRechazado = await invocarController(proponerNomina, {
    userId: capitan.id,
    params: { partido_id: String(partidoId) },
    body: {
      team_id: teamId,
      jugadores: [
        {
          user_id: invitadoRechazado.id,
          dorsal: 9,
          rol_nomina: 'TITULAR'
        }
      ]
    }
  });
  console.log(`HTTP ${nominaRechazado.statusCode}`);
  console.log(JSON.stringify(nominaRechazado.body, null, 2));

  if (nominaRechazado.statusCode !== 400) {
    throw new Error('Se esperaba HTTP 400 al proponer nómina con jugador RECHAZADO.');
  }

  console.log('\n--- POST /api/partidos/:partido_id/nominas (jugador ACEPTADO → debe funcionar) ---');
  const nominaAceptado = await invocarController(proponerNomina, {
    userId: capitan.id,
    params: { partido_id: String(partidoId) },
    body: {
      team_id: teamId,
      jugadores: [
        {
          user_id: invitadoAceptado.id,
          dorsal: 10,
          rol_nomina: 'TITULAR'
        }
      ]
    }
  });
  console.log(`HTTP ${nominaAceptado.statusCode}`);
  console.log(JSON.stringify(nominaAceptado.body, null, 2));

  if (nominaAceptado.statusCode !== 201) {
    throw new Error('Se esperaba HTTP 201 al proponer nómina con jugador ACEPTADO.');
  }

  console.log('\n✓ Caso 3 verificado: PENDIENTE y RECHAZADO rechazados; ACEPTADO permitido.');

  console.log('\n=== Fin del script — todos los casos pasaron ===');
} catch (error) {
  console.error('\nError en test-equipos:', error.message ?? error);
  process.exitCode = 1;
} finally {
  if (partidoId != null) {
    console.log(`\nLimpiando partido de prueba id=${partidoId}...`);
    await limpiarPartidoPrueba(partidoId);
  }

  if (torneoId != null) {
    console.log(`Limpiando torneo de prueba id=${torneoId}...`);
    await Torneos.destroy({ where: { id: torneoId } });
  }

  if (teamId != null) {
    console.log(`Limpiando equipo de prueba id=${teamId}...`);
    await limpiarEquipoPrueba(teamId);
  }

  await sequelize.close();
}
