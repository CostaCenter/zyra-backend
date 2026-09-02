/**
 * Limpieza puntual (one-off): datos de prueba en Zyra CUP (id=5).
 * NO reutilizar en scripts automatizados. Ver reglas en scripts/README.md.
 */
import sequelize from '../src/config/database.js';
import {
  Torneos,
  Partidos,
  TorneoInscripcion,
  Team,
  MarcadoresDetalle,
  EventosPartido,
  PartidoConfirmaciones,
  PartidoParticipantes,
  PartidoJugadorStats,
  PartidoNominas,
  ProgresionFixture
} from '../src/db/db.js';
import { getTorneoById } from '../src/controllers/torneosController.js';

const TORNEO_ID = 5;
const PARTIDO_ID = 17;
const TEAM_NAMES = [
  'TEST_GENERAR_FIXTURE_ZYRA_TEAM_1',
  'TEST_GENERAR_FIXTURE_ZYRA_TEAM_2'
];

const invocarGetTorneo = async (torneoId, userId) => {
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
  await getTorneoById(
    { userId, params: { torneo_id: String(torneoId) } },
    res
  );
  return res;
};

const eliminarPartidoYRelacionados = async (partidoId, transaction) => {
  const partido = await Partidos.findByPk(partidoId, { transaction });
  if (!partido) {
    console.log(`Partido id=${partidoId}: no existe, omitido.`);
    return;
  }

  await MarcadoresDetalle.destroy({ where: { partido_id: partidoId }, transaction });
  await EventosPartido.destroy({ where: { partido_id: partidoId }, transaction });
  await PartidoConfirmaciones.destroy({ where: { partido_id: partidoId }, transaction });
  await PartidoParticipantes.destroy({ where: { partido_id: partidoId }, transaction });
  await PartidoJugadorStats.destroy({ where: { partido_id: partidoId }, transaction });
  await PartidoNominas.destroy({ where: { partido_id: partidoId }, transaction });
  await ProgresionFixture.destroy({
    where: { partido_origen_id: partidoId },
    transaction
  });
  await ProgresionFixture.destroy({
    where: { partido_destino_id: partidoId },
    transaction
  });

  await partido.destroy({ transaction });
  console.log(`Partido id=${partidoId} eliminado (y registros asociados).`);
};

try {
  console.log('=== Limpieza Zyra CUP (id=5) ===\n');

  const torneo = await Torneos.findByPk(TORNEO_ID);
  if (!torneo) {
    throw new Error(`Torneo id=${TORNEO_ID} no encontrado.`);
  }

  console.log(`Torneo: "${torneo.nombre}" (organizador=${torneo.creado_por_user_id})\n`);

  await sequelize.transaction(async (transaction) => {
    await eliminarPartidoYRelacionados(PARTIDO_ID, transaction);

    for (const teamName of TEAM_NAMES) {
      const equipo = await Team.findOne({ where: { name: teamName }, transaction });
      if (!equipo) {
        console.log(`Equipo "${teamName}": no encontrado, omitido.`);
        continue;
      }

      const eliminadas = await TorneoInscripcion.destroy({
        where: { torneo_id: TORNEO_ID, team_id: equipo.id },
        transaction
      });
      console.log(
        eliminadas
          ? `Inscripción eliminada: torneo_id=${TORNEO_ID}, team_id=${equipo.id} (${teamName})`
          : `Sin inscripción para "${teamName}" en torneo ${TORNEO_ID}.`
      );
    }
  });

  const detalle = await invocarGetTorneo(TORNEO_ID, torneo.creado_por_user_id);
  const data = detalle.body?.data ?? {};

  console.log('\n--- GET /api/torneos/5 (simulado vía getTorneoById) ---');
  console.log(`HTTP ${detalle.statusCode}`);
  console.log(
    JSON.stringify(
      {
        id: data.id,
        nombre: data.nombre,
        equipos_inscritos: data.equipos_inscritos,
        num_partidos: data.partidos?.length ?? 0,
        partidos: data.partidos ?? [],
        inscripciones_aceptadas: (data.inscripciones ?? []).filter(
          (i) => i.estado === 'ACEPTADA'
        ).length
      },
      null,
      2
    )
  );

  const ok =
    (data.equipos_inscritos ?? 0) === 0 &&
    (data.partidos?.length ?? 0) === 0;

  if (ok) {
    console.log('\n✓ Zyra CUP quedó con 0 equipos inscritos y 0 partidos.');
  } else {
    throw new Error('La limpieza no dejó el torneo en el estado esperado.');
  }
} catch (error) {
  console.error('\nError:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
