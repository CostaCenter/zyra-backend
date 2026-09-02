import sequelize from '../src/config/database.js';
import {
  Torneos,
  FaseTorneo,
  GrupoDivision,
  GrupoEquipos,
  TorneoInscripcion,
  Team,
  User,
  Sports
} from '../src/db/db.js';
import { generarRoundRobin } from '../src/services/generadorFixture.js';

const TORNEO_NOMBRE = 'TEST_GENERAR_FIXTURE_ZYRA';
const FASE_ORDEN = 1;
const GRUPO_A_NOMBRE = 'Grupo A test fixture';
const GRUPO_B_NOMBRE = 'Grupo B test fixture';

const obtenerUsuario = async () => {
  const usuario = await User.findOne({ order: [['id', 'ASC']] });
  if (!usuario) {
    throw new Error('No hay usuarios en la base de datos.');
  }
  return usuario;
};

const obtenerSport = async () => {
  const sport = await Sports.findOne({ order: [['id', 'ASC']] });
  if (!sport) {
    throw new Error('No hay deportes en la base de datos.');
  }
  return sport;
};

const obtenerOCrearTorneo = async (userId, sportId) => {
  let torneo = await Torneos.findOne({ where: { nombre: TORNEO_NOMBRE } });

  if (!torneo) {
    torneo = await Torneos.create({
      nombre: TORNEO_NOMBRE,
      sport_id: sportId,
      creado_por_user_id: userId,
      reglas_arbitraje_json: {
        puntos_por_set: 25,
        ventaja_obligatoria: 2,
        sets_para_ganar: 3
      },
      visibilidad: 'PRIVADO'
    });
    console.log(`Torneo creado: id=${torneo.id}`);
  } else {
    if (torneo.visibilidad !== 'PRIVADO') {
      await torneo.update({ visibilidad: 'PRIVADO' });
    }
    console.log(`Torneo reutilizado: id=${torneo.id}`);
  }

  return torneo;
};

const obtenerOCrearFase = async (torneoId) => {
  let fase = await FaseTorneo.findOne({
    where: {
      torneo_id: torneoId,
      orden: FASE_ORDEN,
      tipo_formato: 'TODOS_CONTRA_TODOS'
    }
  });

  if (!fase) {
    fase = await FaseTorneo.create({
      torneo_id: torneoId,
      orden: FASE_ORDEN,
      tipo_formato: 'TODOS_CONTRA_TODOS',
      nombre: 'Fase round-robin test'
    });
    console.log(`Fase creada: id=${fase.id}`);
  } else {
    console.log(`Fase reutilizada: id=${fase.id}`);
  }

  return fase;
};

const asegurarCuatroInscripciones = async (torneoId, userId, sportId) => {
  const inscripciones = await TorneoInscripcion.findAll({
    where: { torneo_id: torneoId, estado: 'ACEPTADA' },
    attributes: ['team_id']
  });

  const teamIds = [...new Set(inscripciones.map((i) => i.team_id))];
  console.log(`Inscripciones ACEPTADA actuales: ${teamIds.length} (${teamIds.join(', ') || 'ninguna'})`);

  let siguienteIndice = 1;

  while (teamIds.length < 4) {
    const nombreEquipo = `${TORNEO_NOMBRE}_TEAM_${siguienteIndice}`;
    let equipo = await Team.findOne({ where: { name: nombreEquipo } });

    if (!equipo) {
      equipo = await Team.create({
        name: nombreEquipo,
        sport_id: sportId,
        capitan_id: userId
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
        iniciado_por_id: userId,
        estado: 'ACEPTADA',
        resuelto_por_id: userId,
        resuelto_at: new Date()
      });
    } else if (existente.estado !== 'ACEPTADA') {
      await existente.update({
        estado: 'ACEPTADA',
        resuelto_por_id: userId,
        resuelto_at: new Date()
      });
    }

    if (!teamIds.includes(equipo.id)) {
      teamIds.push(equipo.id);
    }

    siguienteIndice += 1;
  }

  return teamIds.slice(0, 4).sort((a, b) => a - b);
};

const limpiarPartidosFase = async (faseId) => {
  const partidoIdsSubquery = 'SELECT id FROM partidos WHERE fase_torneo_id = :faseId';

  await sequelize.query(
    `DELETE FROM marcadores_detalle WHERE partido_id IN (${partidoIdsSubquery})`,
    { replacements: { faseId } }
  );
  await sequelize.query(
    `DELETE FROM eventos_partido WHERE partido_id IN (${partidoIdsSubquery})`,
    { replacements: { faseId } }
  );
  await sequelize.query(
    `
    DELETE FROM progresion_fixture
    WHERE partido_origen_id IN (${partidoIdsSubquery})
       OR partido_destino_id IN (${partidoIdsSubquery})
    `,
    { replacements: { faseId } }
  );
  await sequelize.query(
    `
    DELETE FROM "Partido_Participantes"
    WHERE partido_id IN (${partidoIdsSubquery})
    `,
    { replacements: { faseId } }
  );
  const [, meta] = await sequelize.query(
    'DELETE FROM partidos WHERE fase_torneo_id = :faseId',
    { replacements: { faseId } }
  );
  console.log(`Partidos eliminados de fase ${faseId}: ${meta?.rowCount ?? '?'}`);
};

const obtenerOCrearGrupo = async (faseId, nombre) => {
  let grupo = await GrupoDivision.findOne({
    where: { fase_torneo_id: faseId, nombre }
  });

  if (!grupo) {
    grupo = await GrupoDivision.create({
      fase_torneo_id: faseId,
      nombre
    });
    console.log(`Grupo creado: id=${grupo.id} (${nombre})`);
  } else {
    console.log(`Grupo reutilizado: id=${grupo.id} (${nombre})`);
  }

  return grupo;
};

const asignarEquipoGrupo = async (grupoId, teamId) => {
  const existente = await GrupoEquipos.findOne({
    where: { grupo_division_id: grupoId, team_id: teamId }
  });

  if (!existente) {
    await GrupoEquipos.create({
      grupo_division_id: grupoId,
      team_id: teamId
    });
    console.log(`Asignado team_id=${teamId} → grupo_id=${grupoId}`);
  } else {
    console.log(`Ya asignado team_id=${teamId} → grupo_id=${grupoId}`);
  }
};

const imprimirPartidos = async (torneoId) => {
  const [filas] = await sequelize.query(
    `
    SELECT
      p.id,
      p.fase_torneo_id AS fase,
      p.grupo_division_id,
      local_pp.team_id AS equipo_local_id,
      visitante_pp.team_id AS equipo_visitante_id
    FROM partidos p
    LEFT JOIN "Partido_Participantes" local_pp
      ON local_pp.partido_id = p.id AND local_pp.es_local = true
    LEFT JOIN "Partido_Participantes" visitante_pp
      ON visitante_pp.partido_id = p.id AND visitante_pp.es_local = false
    WHERE p.torneo_id = :torneoId
    ORDER BY p.grupo_division_id NULLS LAST, p.id
    `,
    { replacements: { torneoId } }
  );

  console.log('\n--- Partidos en BD (torneo_id =', torneoId, ') ---');
  if (filas.length === 0) {
    console.log('(sin filas)');
    return;
  }

  console.table(filas);
};

const ejecutarGeneracion = async (faseId, grupoId, etiqueta) => {
  console.log(`\n========== ${etiqueta} ==========`);
  console.log(`Llamando generarRoundRobin(${faseId}, ${grupoId})...\n`);

  const resultado = await generarRoundRobin(faseId, grupoId);

  if (resultado.error) {
    console.log('Resultado (error):', resultado.error);
  } else {
    console.log(`Resultado: ${resultado.partidos.length} partido(s) creado(s)`);
    console.log(JSON.stringify(resultado, null, 2));
  }

  return resultado;
};

try {
  console.log('=== Setup test-generar-fixture (por grupo) ===\n');

  const usuario = await obtenerUsuario();
  const sport = await obtenerSport();
  const torneo = await obtenerOCrearTorneo(usuario.id, sport.id);
  const fase = await obtenerOCrearFase(torneo.id);
  const teamIds = await asegurarCuatroInscripciones(torneo.id, usuario.id, sport.id);

  console.log(`\nTorneo id=${torneo.id}, Fase id=${fase.id}, Equipos: ${teamIds.join(', ')}`);

  await limpiarPartidosFase(fase.id);

  const grupoA = await obtenerOCrearGrupo(fase.id, GRUPO_A_NOMBRE);
  const grupoB = await obtenerOCrearGrupo(fase.id, GRUPO_B_NOMBRE);

  await asignarEquipoGrupo(grupoA.id, teamIds[0]);
  await asignarEquipoGrupo(grupoA.id, teamIds[1]);
  await asignarEquipoGrupo(grupoB.id, teamIds[2]);
  await asignarEquipoGrupo(grupoB.id, teamIds[3]);

  await ejecutarGeneracion(fase.id, grupoA.id, 'GRUPO A — primera generación');
  await imprimirPartidos(torneo.id);

  await ejecutarGeneracion(fase.id, grupoB.id, 'GRUPO B — primera generación (misma fase)');
  await imprimirPartidos(torneo.id);

  await ejecutarGeneracion(fase.id, grupoA.id, 'GRUPO A — segunda generación (debe bloquear)');
  await imprimirPartidos(torneo.id);

  console.log('\n=== Fin del script ===');
} catch (error) {
  console.error('Error en test-generar-fixture:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
