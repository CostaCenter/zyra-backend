import sequelize from '../src/config/database.js';
import { Partidos, GrupoDivision } from '../src/db/db.js';
import { calcularPosicionesTorneo } from '../src/services/calcularPosicionesTorneo.js';

const TORNEO_ID = 2;

const asegurarPartidosFinalizados = async () => {
  const partidos = await Partidos.findAll({
    where: { torneo_id: TORNEO_ID },
    attributes: ['id', 'grupo_division_id', 'state', 'score_local_final', 'score_visitante_final'],
    order: [['id', 'ASC']]
  });

  if (partidos.length === 0) {
    throw new Error(`No hay partidos para torneo_id=${TORNEO_ID}. Ejecuta test-generar-fixture.mjs primero.`);
  }

  console.log('Partidos actuales del torneo:');
  console.table(partidos.map((p) => p.toJSON()));

  const resultadosPorOrden = [
    { local: 3, visitante: 1 },
    { local: 2, visitante: 3 }
  ];

  for (const [index, partido] of partidos.entries()) {
    const simulado = resultadosPorOrden[index] ?? { local: 3, visitante: 0 };

    if (partido.state !== 'FINALIZADO') {
      await partido.update({
        state: 'FINALIZADO',
        score_local_final: simulado.local,
        score_visitante_final: simulado.visitante
      });
      console.log(
        `Partido ${partido.id} marcado FINALIZADO: ${simulado.local}-${simulado.visitante}`
      );
    }
  }
};

const imprimirTabla = (titulo, posiciones) => {
  console.log(`\n=== ${titulo} ===`);
  if (posiciones.length === 0) {
    console.log('(sin equipos)');
    return;
  }

  console.table(
    posiciones.map((fila, index) => ({
      pos: index + 1,
      team_id: fila.team_id,
      equipo: fila.team_nombre,
      pj: fila.partidos_jugados,
      g: fila.ganados,
      p: fila.perdidos,
      sf: fila.sets_favor,
      sc: fila.sets_contra,
      dif: fila.diferencia_sets,
      pts: fila.puntos
    }))
  );
};

try {
  console.log('=== test-posiciones ===\n');

  await asegurarPartidosFinalizados();

  const posicionesTorneo = await calcularPosicionesTorneo(TORNEO_ID);
  imprimirTabla(`Torneo ${TORNEO_ID} — tabla general`, posicionesTorneo);

  const grupos = await GrupoDivision.findAll({
    where: { fase_torneo_id: 2 },
    attributes: ['id', 'nombre'],
    order: [['id', 'ASC']]
  });

  for (const grupo of grupos) {
    const posicionesGrupo = await calcularPosicionesTorneo(TORNEO_ID, grupo.id);
    imprimirTabla(`Grupo ${grupo.nombre} (id=${grupo.id})`, posicionesGrupo);
  }

  console.log('\n=== Fin del script ===');
} catch (error) {
  console.error('Error en test-posiciones:', error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
