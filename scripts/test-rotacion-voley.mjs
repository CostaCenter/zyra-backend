/**
 * Script de prueba: rotación automática de vóley.
 * Ejecutar: node scripts/test-rotacion-voley.mjs
 */
import {
  reducirPosicionesVolley,
  rotarPosicionesEquipo,
  aplicarRotacionVolleyPorPunto,
  estadoPosicionesInicial,
} from '../src/services/reducerPartido.js';

const J = {
  z1: 101,
  z2: 102,
  z3: 103,
  z4: 104,
  z5: 105,
  z6: 106,
};

const J_V = {
  z1: 201,
  z2: 202,
  z3: 203,
  z4: 204,
  z5: 205,
  z6: 206,
};

const posInicialLocal = [J.z1, J.z2, J.z3, J.z4, J.z5, J.z6];
const posInicialVisitante = [J_V.z1, J_V.z2, J_V.z3, J_V.z4, J_V.z5, J_V.z6];

function crearPunto(id, equipo, secuencia) {
  return {
    id,
    dispositivo_id: 'dev-test',
    secuencia_local: secuencia,
    ocurrido_en_cliente: `2026-08-26T10:${String(secuencia).padStart(2, '0')}:00Z`,
    tipo_evento: 'PUNTO',
    detalle_json: { equipo },
  };
}

function indiceZona(posiciones, jugadorId) {
  const idx = posiciones.indexOf(jugadorId);
  return idx >= 0 ? idx + 1 : null;
}

function assert(condicion, mensaje) {
  if (!condicion) {
    throw new Error(`FAIL: ${mensaje}`);
  }
}

console.log('=== Test rotación vóley — reducer ===\n');

// --- Test unitario: rotarPosicionesEquipo ---
{
  const rotado = rotarPosicionesEquipo(posInicialLocal);
  assert(rotado[0] === J.z2, 'z1 recibe de z2');
  assert(rotado[5] === J.z1, 'z6 recibe de z1');
  console.log('✓ rotarPosicionesEquipo: z2→z1, z1→z6 (horario FIVB)');
}

// --- Secuencia real simulada ---
// Local saca al inicio. Secuencia de puntos:
// 1. LOCAL (mantiene saque) → sin rotación local
// 2. LOCAL (mantiene) → sin rotación
// 3. VISITANTE (side-out) → visitante rota, visitante saca
// 4. VISITANTE (mantiene) → sin rotación visitante
// 5. LOCAL (side-out) → local rota, local saca
// 6. LOCAL (mantiene)
// 7. VISITANTE (side-out) → visitante rota otra vez
// 8. VISITANTE (mantiene)
// 9. LOCAL (side-out) → local rota segunda vez (jugador z1 original debe ir a z3)

const secuencia = [
  { eq: 'LOCAL', sideOut: false, rotar: null },
  { eq: 'LOCAL', sideOut: false, rotar: null },
  { eq: 'VISITANTE', sideOut: true, rotar: 'visitante' },
  { eq: 'VISITANTE', sideOut: false, rotar: null },
  { eq: 'LOCAL', sideOut: true, rotar: 'local' },
  { eq: 'LOCAL', sideOut: false, rotar: null },
  { eq: 'VISITANTE', sideOut: true, rotar: 'visitante' },
  { eq: 'VISITANTE', sideOut: false, rotar: null },
  { eq: 'LOCAL', sideOut: true, rotar: 'local' },
];

const eventos = secuencia.map((s, i) => crearPunto(`p-${i + 1}`, s.eq, i + 1));

const posicionesIniciales = {
  equipo_local: [...posInicialLocal],
  equipo_visitante: [...posInicialVisitante],
};

let estado = estadoPosicionesInicial(posicionesIniciales, 'local');
const historial = [];
let rotacionesLocal = 0;
let rotacionesVisitante = 0;

for (let i = 0; i < eventos.length; i++) {
  const antes = {
    local: [...estado.posiciones_actuales.equipo_local],
    visitante: [...estado.posiciones_actuales.equipo_visitante],
    saca: estado.equipo_que_saca,
  };
  const prevLocal = [...antes.local];
  const prevVisitante = [...antes.visitante];

  estado = aplicarRotacionVolleyPorPunto(estado, eventos[i]);

  const despues = estado.posiciones_actuales;
  const esperado = secuencia[i];
  const equipoLlave = esperado.eq === 'LOCAL' ? 'local' : 'visitante';

  const localCambio = JSON.stringify(prevLocal) !== JSON.stringify(despues.equipo_local);
  const visitanteCambio = JSON.stringify(prevVisitante) !== JSON.stringify(despues.equipo_visitante);

  if (esperado.rotar === 'local') {
    assert(localCambio, `Punto ${i + 1}: debía rotar LOCAL`);
    assert(!visitanteCambio, `Punto ${i + 1}: visitante NO debía rotar`);
    rotacionesLocal += 1;
  } else if (esperado.rotar === 'visitante') {
    assert(visitanteCambio, `Punto ${i + 1}: debía rotar VISITANTE`);
    assert(!localCambio, `Punto ${i + 1}: local NO debía rotar`);
    rotacionesVisitante += 1;
  } else {
    assert(!localCambio && !visitanteCambio, `Punto ${i + 1}: ningún equipo debía rotar`);
  }

  assert(estado.equipo_que_saca === equipoLlave, `Punto ${i + 1}: saque = ${equipoLlave}`);

  historial.push({
    punto: i + 1,
    anoto: esperado.eq,
    sideOut: esperado.sideOut,
    rotó: esperado.rotar ?? '—',
    saca: estado.equipo_que_saca,
    j101_zona: indiceZona(despues.equipo_local, J.z1),
    j201_zona: indiceZona(despues.equipo_visitante, J_V.z1),
  });
}

console.log('\n--- Historial punto a punto ---');
console.table(historial);

// Jugador 101 empezó en zona 1. Tras 2 rotaciones locales (puntos 5 y 9):
// Rotación 1: 101 → zona 6
// Rotación 2: 101 → zona 5
const zonaFinal101 = indiceZona(estado.posiciones_actuales.equipo_local, J.z1);
assert(zonaFinal101 === 5, `Jugador 101 debe estar en zona 5 tras 2 side-outs locales (está en ${zonaFinal101})`);
console.log(`✓ Jugador 101 (inicio z1): tras 2 rotaciones locales → zona ${zonaFinal101} (esperado 5)`);

// Jugador visitante 201: 2 rotaciones en puntos 3 y 7 → z6 luego z5
const zonaFinal201 = indiceZona(estado.posiciones_actuales.equipo_visitante, J_V.z1);
assert(zonaFinal201 === 5, `Jugador 201 debe estar en zona 5 tras 2 side-outs visitante (está en ${zonaFinal201})`);
console.log(`✓ Jugador 201 (inicio z1): tras 2 rotaciones visitante → zona ${zonaFinal201} (esperado 5)`);

// Verificar reducirPosicionesVolley produce mismo resultado
const reducido = reducirPosicionesVolley(eventos, posicionesIniciales, 'local');
assert(
  JSON.stringify(reducido.posiciones_actuales) === JSON.stringify(estado.posiciones_actuales),
  'reducirPosicionesVolley debe coincidir con aplicación incremental'
);
assert(reducido.equipo_que_saca === 'local', 'Tras punto 9 LOCAL, saca local');
console.log('✓ reducirPosicionesVolley coincide con secuencia incremental');

console.log('\n=== RESUMEN ===');
console.log(`Rotaciones local: ${rotacionesLocal} (esperado 2)`);
console.log(`Rotaciones visitante: ${rotacionesVisitante} (esperado 2)`);
console.log(`Posiciones finales local:    [${estado.posiciones_actuales.equipo_local.join(', ')}]`);
console.log(`Posiciones finales visitante: [${estado.posiciones_actuales.equipo_visitante.join(', ')}]`);
console.log(`Equipo que saca: ${estado.equipo_que_saca}`);
console.log('\n✅ Todos los tests de rotación pasaron.\n');
