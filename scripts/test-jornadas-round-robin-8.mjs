/**
 * Valida el método del círculo para 8 equipos.
 *
 * Uso: node scripts/test-jornadas-round-robin-8.mjs
 */
import { generarJornadasCircleMethod } from '../src/services/generadorFixture.js';
import sequelize from '../src/config/database.js';

const TEAM_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

const validarJornadas = (jornadas, teamIds) => {
  const errores = [];
  const n = teamIds.length;

  if (jornadas.length !== n - 1) {
    errores.push(`Se esperaban ${n - 1} jornadas, hay ${jornadas.length}`);
  }

  for (let i = 0; i < jornadas.length; i += 1) {
    const num = i + 1;
    const partidos = jornadas[i];

    if (partidos.length !== n / 2) {
      errores.push(`Jornada ${num}: se esperaban ${n / 2} partidos, hay ${partidos.length}`);
    }

    const equiposEnJornada = new Set();
    for (const [local, visitante] of partidos) {
      if (equiposEnJornada.has(local)) {
        errores.push(`Jornada ${num}: equipo ${local} aparece más de una vez`);
      }
      if (equiposEnJornada.has(visitante)) {
        errores.push(`Jornada ${num}: equipo ${visitante} aparece más de una vez`);
      }
      equiposEnJornada.add(local);
      equiposEnJornada.add(visitante);
    }
  }

  return errores;
};

console.log('=== test-jornadas-round-robin-8 ===\n');

console.log('--- Algoritmo (método del círculo) ---');
const jornadas = generarJornadasCircleMethod(TEAM_IDS);
console.log(`Equipos: ${TEAM_IDS.length}`);
console.log(`Jornadas: ${jornadas.length}`);
console.log(`Partidos por jornada: ${jornadas.map((j) => j.length).join(', ')}`);

const erroresAlgo = validarJornadas(jornadas, TEAM_IDS);
if (erroresAlgo.length) {
  console.error('❌ Validación algoritmo falló:');
  erroresAlgo.forEach((e) => console.error(`  - ${e}`));
  process.exitCode = 1;
} else {
  console.log('✅ 7 jornadas, 4 partidos c/u, sin equipos repetidos en la misma jornada\n');
}

await sequelize.close();
