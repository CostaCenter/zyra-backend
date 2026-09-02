/**
 * Asigna jornada a partidos round-robin existentes según el método del círculo.
 *
 * Uso:
 *   node scripts/backfill-jornadas-torneo.mjs "Zyra Celestial"
 *   node scripts/backfill-jornadas-torneo.mjs 14
 */
import sequelize from '../src/config/database.js';
import {
  Torneos,
  FaseTorneo,
  Partidos,
  PartidoParticipantes,
  TorneoInscripcion,
} from '../src/db/db.js';
import { generarJornadasCircleMethod } from '../src/services/generadorFixture.js';

const arg = process.argv[2] ?? 'Zyra Celestial';

const clavePar = (a, b) => [a, b].sort((x, y) => x - y).join('-');

const resolverTorneo = async () => {
  const idNum = Number(arg);
  if (!Number.isNaN(idNum) && idNum > 0) {
    return Torneos.findByPk(idNum, { attributes: ['id', 'nombre'] });
  }

  return Torneos.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('nombre')),
      'LIKE',
      `%${arg.toLowerCase()}%`
    ),
    attributes: ['id', 'nombre'],
  });
};

try {
  const torneo = await resolverTorneo();
  if (!torneo) {
    throw new Error(`No se encontró torneo: ${arg}`);
  }

  console.log(`=== backfill jornadas — ${torneo.nombre} (#${torneo.id}) ===\n`);

  const fases = await FaseTorneo.findAll({
    where: { torneo_id: torneo.id, tipo_formato: 'TODOS_CONTRA_TODOS' },
    attributes: ['id', 'nombre', 'orden'],
    order: [['orden', 'ASC']],
  });

  if (!fases.length) {
    throw new Error('El torneo no tiene fases TODOS_CONTRA_TODOS.');
  }

  const inscripciones = await TorneoInscripcion.findAll({
    where: { torneo_id: torneo.id, estado: 'ACEPTADA' },
    attributes: ['team_id'],
    order: [['team_id', 'ASC']],
  });
  const teamIds = [...new Set(inscripciones.map((i) => i.team_id))];

  if (teamIds.length < 2) {
    throw new Error('Se necesitan al menos 2 equipos inscritos (ACEPTADA).');
  }

  console.log(`Equipos inscritos: ${teamIds.length}`);

  let totalActualizados = 0;

  for (const fase of fases) {
    const partidos = await Partidos.findAll({
      where: { torneo_id: torneo.id, fase_torneo_id: fase.id },
      attributes: ['id', 'jornada'],
      order: [['id', 'ASC']],
    });

    if (!partidos.length) {
      console.log(`Fase ${fase.nombre ?? fase.id}: sin partidos, se omite.`);
      continue;
    }

    const participantes = await PartidoParticipantes.findAll({
      where: { partido_id: partidos.map((p) => p.id) },
      attributes: ['partido_id', 'team_id', 'es_local'],
    });

    const parPorPartido = new Map();
    for (const partido of partidos) {
      const filas = participantes.filter((p) => p.partido_id === partido.id);
      const local = filas.find((p) => p.es_local)?.team_id;
      const visitante = filas.find((p) => !p.es_local)?.team_id;
      if (!local || !visitante) {
        throw new Error(`Partido #${partido.id} no tiene local y visitante completos.`);
      }
      parPorPartido.set(partido.id, clavePar(local, visitante));
    }

    const jornadas = generarJornadasCircleMethod(teamIds);
    const jornadaPorPar = new Map();

    for (let i = 0; i < jornadas.length; i += 1) {
      const numeroJornada = i + 1;
      for (const [local, visitante] of jornadas[i]) {
        jornadaPorPar.set(clavePar(local, visitante), numeroJornada);
      }
    }

    const sinMapear = [];
    const actualizaciones = [];

    for (const partido of partidos) {
      const par = parPorPartido.get(partido.id);
      const jornada = jornadaPorPar.get(par);
      if (jornada == null) {
        sinMapear.push({ partidoId: partido.id, par });
        continue;
      }
      if (partido.jornada !== jornada) {
        actualizaciones.push({ id: partido.id, jornada });
      }
    }

    if (sinMapear.length) {
      console.error('Partidos sin jornada calculada:', sinMapear);
      throw new Error(`Fase ${fase.id}: ${sinMapear.length} partido(s) no encajan en el round-robin.`);
    }

    await sequelize.transaction(async (transaction) => {
      for (const { id, jornada } of actualizaciones) {
        await Partidos.update({ jornada }, { where: { id }, transaction });
      }
    });

    const resumen = jornadas.map((j, idx) => `J${idx + 1}:${j.length}`).join(', ');
    console.log(
      `Fase ${fase.nombre ?? fase.id}: ${partidos.length} partidos → ${jornadas.length} jornadas (${resumen})`
    );
    console.log(`  Actualizados: ${actualizaciones.length}`);

    totalActualizados += actualizaciones.length;
  }

  console.log(`\n✅ Listo. ${totalActualizados} partido(s) con jornada asignada.`);
} catch (error) {
  console.error('\nError:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
