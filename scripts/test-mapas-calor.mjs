import assert from 'node:assert/strict';
import {
  calcularMapasCalorPartido,
  aplicarCambioEnPosiciones,
  zonaDeJugadorEnPosiciones,
} from '../src/services/mapasCalorService.js';
import { aplicarRotacionVolleyPorPunto, estadoPosicionesInicial } from '../src/services/reducerPartido.js';

const J = [101, 102, 103, 104, 105, 106];
const R = [201, 202, 203, 204, 205, 206];

function punto(id, equipo, seq, extra = {}) {
  return {
    id,
    dispositivo_id: 'dev-1',
    secuencia_local: seq,
    ocurrido_en_cliente: `2026-08-26T10:${String(seq).padStart(2, '0')}:00Z`,
    tipo_evento: 'PUNTO',
    detalle_json: { equipo, ...extra },
  };
}

function cambio(id, equipo, saliente, entrante, seq) {
  return {
    id,
    dispositivo_id: 'dev-1',
    secuencia_local: seq,
    ocurrido_en_cliente: `2026-08-26T10:${String(seq).padStart(2, '0')}:30Z`,
    tipo_evento: 'CAMBIO',
    detalle_json: { equipo, saliente_id: saliente, entrante_id: entrante },
  };
}

console.log('=== test-mapas-calor-service (unitario) ===\n');

const posicionesIniciales = { equipo_local: [...J], equipo_visitante: [...R] };
const participantes = [
  { team_id: 40, es_local: true },
  { team_id: 12, es_local: false },
];

// LOCAL saca, anota 3 seguidos (sin rotación), side-out visitante, rota visitante
const eventos = [
  punto('p1', 'LOCAL', 1, { origen: 'JUGADOR', jugador_id: J[0] }),
  punto('p2', 'LOCAL', 2, { origen: 'JUGADOR', jugador_id: J[0] }),
  punto('p3', 'VISITANTE', 3, { origen: 'JUGADOR', jugador_id: R[0] }),
];

const mapas = calcularMapasCalorPartido({
  eventos,
  posicionesIniciales,
  equipoQueSacaInicial: 'local',
  participantes,
  jugadorId: J[0],
  teamId: 40,
});

assert.equal(mapas.jugador.total, 3, 'jugador z1 presente en los 3 puntos');
assert.equal(mapas.jugador.zonas.find((z) => z.zona === 1)?.count, 3);
assert.ok(mapas.jugador.validacion.cuadra, 'validación jugador cuadra');

assert.equal(mapas.equipo.total, 2, 'equipo local anotó 2 con jugador');
assert.equal(mapas.equipo.zonas.find((z) => z.zona === 1)?.count, 2);
assert.ok(mapas.equipo.validacion.cuadra, 'validación equipo cuadra');

assert.equal(mapas.jugador.recibidos.total, 1, 'jugador recibió 1 punto rival en cancha');
assert.equal(mapas.jugador.recibidos.zonas.find((z) => z.zona === 1)?.count, 1);
assert.ok(mapas.jugador.recibidos.validacion.cuadra, 'validación recibidos jugador');

assert.equal(mapas.equipo.recibidos.total, 1, 'equipo recibió 1 punto rival');
assert.equal(mapas.equipo.recibidos.validacion.puntos_rival_partido, 1);
assert.ok(mapas.equipo.recibidos.validacion.cuadra, 'validación recibidos equipo');

console.log('✓ escenario básico sin cambios');

// Cambio: J[5] entra por J[0] en zona 1, luego punto — exposición cuenta zona 1 para suplente
const eventosCambio = [
  ...eventos,
  cambio('c1', 'LOCAL', J[0], J[5], 4),
  punto('p4', 'LOCAL', 5, { origen: 'JUGADOR', jugador_id: J[5] }),
];

const mapasCambio = calcularMapasCalorPartido({
  eventos: eventosCambio,
  posicionesIniciales,
  equipoQueSacaInicial: 'local',
  participantes,
  jugadorId: J[0],
  teamId: 40,
});

assert.equal(mapasCambio.jugador.total, 3, 'J[0] solo estuvo en cancha 3 puntos');
assert.equal(mapasCambio.equipo.total, 3, 'equipo local 3 puntos JUGADOR');
assert.ok(mapasCambio.jugador.validacion.cuadra);
assert.ok(mapasCambio.equipo.validacion.cuadra);

console.log('✓ escenario con cambio');

// Side-out rota visitante: tras p3, R[0] pasa de z1 a z6
let estado = estadoPosicionesInicial(posicionesIniciales, 'local');
estado = aplicarRotacionVolleyPorPunto(estado, eventos[2]);
assert.equal(
  zonaDeJugadorEnPosiciones(estado.posiciones_actuales, 'equipo_visitante', R[0]),
  6,
  'side-out visitante rota z1→z6'
);

console.log('✓ rotación side-out coherente con reducer\n');
console.log('Todos los tests unitarios pasaron.');
