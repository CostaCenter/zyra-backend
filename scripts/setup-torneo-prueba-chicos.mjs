/**
 * Inscribe 8 equipos de vóley en "Prueba con los chicos" (incluye KABO CLUB y Apex club).
 * Ejecutar: node scripts/setup-torneo-prueba-chicos.mjs
 */
import sequelize from '../src/config/database.js';
import { Torneos, TorneoInscripcion, TorneoArbitros, User } from '../src/db/db.js';

const TORNEO_NOMBRE = 'Prueba con los chicos';
const ORGANIZADOR_ID = 1;

/** KABO + Apex + 6 equipos vóley existentes */
const EQUIPOS_IDS = [
  12, // KABO CLUB
  40, // Apex club
  13, // Andres Team FC
  14, // Elementales Group
  36, // SEED_Voleibol Andes
  37, // SEED_Vóley Altura
  38, // SEED_Smash Norte
  39, // SEED_Red Volcán
];

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
    return 'actualizada';
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
  return 'creada';
};

const asegurarArbitroAndres = async (torneoId) => {
  const andres = await User.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('name')),
      'LIKE',
      '%orrego%'
    ),
  }) ?? await User.findOne({ where: { id: ORGANIZADOR_ID } });

  if (!andres) {
    throw new Error('No se encontró Andrés Orrego en la base de datos');
  }

  const existente = await TorneoArbitros.findOne({
    where: { torneo_id: torneoId, usuario_id: andres.id },
  });

  if (!existente) {
    await TorneoArbitros.create({ torneo_id: torneoId, usuario_id: andres.id });
    return { accion: 'creado', usuario: andres };
  }

  return { accion: 'ya_existia', usuario: andres };
};

const asignarArbitroATodosLosPartidos = async (torneoId, arbitroId) => {
  const [result] = await sequelize.query(`
    UPDATE partidos
    SET arbitro_asignado_id = :arbitroId
    WHERE torneo_id = :torneoId
      AND (arbitro_asignado_id IS NULL OR arbitro_asignado_id != :arbitroId)
    RETURNING id
  `, {
    replacements: { torneoId, arbitroId },
  });

  return result.length;
};

try {
  console.log('=== setup-torneo-prueba-chicos ===\n');

  const torneo = await Torneos.findOne({
    where: { nombre: TORNEO_NOMBRE },
    order: [['id', 'DESC']],
  });

  if (!torneo) {
    throw new Error(`No se encontró el torneo "${TORNEO_NOMBRE}"`);
  }

  console.log(`Torneo: id=${torneo.id} · ${torneo.nombre} · max_equipos=${torneo.max_equipos}`);

  const [equipos] = await sequelize.query(`
    SELECT id, name, sport_id FROM "Team"
    WHERE id IN (${EQUIPOS_IDS.join(',')})
    ORDER BY array_position(ARRAY[${EQUIPOS_IDS.join(',')}]::int[], id)
  `);

  if (equipos.length !== EQUIPOS_IDS.length) {
    throw new Error('Faltan equipos en la base de datos');
  }

  const sportInvalido = equipos.filter((e) => e.sport_id !== torneo.sport_id);
  if (sportInvalido.length) {
    throw new Error(
      `Deporte incompatible: ${sportInvalido.map((e) => e.name).join(', ')} (torneo sport_id=${torneo.sport_id})`
    );
  }

  for (const equipo of equipos) {
    const accion = await inscribirEquipo(torneo.id, equipo.id);
    console.log(`  ✓ ${equipo.name} (id=${equipo.id}) — inscripción ${accion}`);
  }

  const [resumen] = await sequelize.query(`
    SELECT t.name, ti.estado
    FROM torneo_inscripciones ti
    JOIN "Team" t ON t.id = ti.team_id
    WHERE ti.torneo_id = ${torneo.id}
    ORDER BY t.name
  `);

  console.log('\nEquipos inscritos en el torneo:');
  console.table(resumen);
  console.log(`\n✅ ${resumen.length} equipos listos en "${torneo.nombre}" (id=${torneo.id}).`);

  const arbitro = await asegurarArbitroAndres(torneo.id);
  console.log(
    `\nÁrbitro: ${arbitro.usuario.name ?? arbitro.usuario.nick} (id=${arbitro.usuario.id}) — ${arbitro.accion}`
  );

  const partidosActualizados = await asignarArbitroATodosLosPartidos(torneo.id, arbitro.usuario.id);
  console.log(`Partidos con árbitro asignado: ${partidosActualizados} actualizado(s)`);
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
