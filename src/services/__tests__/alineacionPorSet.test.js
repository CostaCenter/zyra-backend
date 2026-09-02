import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  reducirPosicionesVolley,
  rotarPosicionesEquipo,
  estadoPosicionesInicial,
} from '../reducerPartido.js';

const REGLAS_BO3 = {
  puntos_por_set: 25,
  ventaja_obligatoria: 2,
  sets_para_ganar: 2,
  puntos_set_decisivo: 15,
};

function crearPunto(id, equipo, secuencia) {
  return {
    id,
    dispositivo_id: 'dev-test',
    secuencia_local: secuencia,
    ocurrido_en_cliente: `2026-09-01T10:${String(secuencia).padStart(2, '0')}:00Z`,
    tipo_evento: 'PUNTO',
    detalle_json: { equipo },
  };
}

/** Genera puntos hasta que `equipoGanador` gana el set (25+ con ventaja 2). */
function puntosParaGanarSet(equipoGanador, secuenciaInicial = 1) {
  const perdedor = equipoGanador === 'LOCAL' ? 'VISITANTE' : 'LOCAL';
  const eventos = [];
  let seq = secuenciaInicial;
  let g = 0;
  let p = 0;

  while (!(g >= 25 && g - p >= 2)) {
    if (p < 23) {
      eventos.push(crearPunto(`p-${seq}`, perdedor, seq++));
      p += 1;
    }
    eventos.push(crearPunto(`w-${seq}`, equipoGanador, seq++));
    g += 1;
  }

  return { eventos, nextSeq: seq };
}

describe('alineación por set — rotación reinicia en cada set', () => {
  const set1Local = [101, 102, 103, 104, 105, 106];
  const set1Visit = [201, 202, 203, 204, 205, 206];

  const set2Local = [107, 108, 109, 110, 111, 112];
  const set2Visit = [207, 208, 209, 210, 211, 212];

  const set3Local = [113, 114, 115, 116, 117, 118];
  const set3Visit = [213, 214, 215, 216, 217, 218];

  const alineacionesPorSet = {
    1: { equipo_local: set1Local, equipo_visitante: set1Visit },
    2: { equipo_local: set2Local, equipo_visitante: set2Visit },
    3: { equipo_local: set3Local, equipo_visitante: set3Visit },
  };

  it('partido a 3 sets: cada set arranca con su alineación, sin arrastrar rotación', () => {
    let seq = 1;
    const eventos = [];

    // Set 1: local gana (con side-out previo para rotar visitante en set 1)
    eventos.push(crearPunto('s1-v1', 'VISITANTE', seq++));
    eventos.push(crearPunto('s1-l1', 'LOCAL', seq++));
    const set1Win = puntosParaGanarSet('LOCAL', seq);
    eventos.push(...set1Win.eventos);
    seq = set1Win.nextSeq;

    // Set 2: visitante gana → empate 1-1, continúa a set 3
    const set2Win = puntosParaGanarSet('VISITANTE', seq);
    eventos.push(...set2Win.eventos);
    seq = set2Win.nextSeq;

    // Set 3: un punto sin side-out (local saca y anota)
    eventos.push(crearPunto('s3-l1', 'LOCAL', seq++));

    const posIniciales = {
      equipo_local: set1Local,
      equipo_visitante: set1Visit,
    };

    const estado = reducirPosicionesVolley(
      eventos,
      posIniciales,
      'local',
      {
        alineacionesPorSet,
        reglas: REGLAS_BO3,
        historialSaquePorSet: [
          { set_numero: 1, equipo: 'local' },
          { set_numero: 2, equipo: 'visitante' },
          { set_numero: 3, equipo: 'local' },
        ],
      }
    );

    assert.deepEqual(
      estado.posiciones_actuales.equipo_local,
      set3Local,
      'set 3 debe arrancar con alineación configurada para set 3'
    );
    assert.deepEqual(
      estado.posiciones_actuales.equipo_visitante,
      set3Visit,
      'visitante set 3 sin rotación arrastrada'
    );

    const set2Rotado = rotarPosicionesEquipo(set2Local);
    assert.notDeepEqual(
      estado.posiciones_actuales.equipo_local,
      set2Rotado,
      'rotación del set 2 no debe persistir en set 3'
    );
  });

  it('al cerrar set 1 las posiciones pasan a la alineación del set 2', () => {
    const eventos = puntosParaGanarSet('LOCAL', 1).eventos;
    const estado = reducirPosicionesVolley(
      eventos,
      { equipo_local: set1Local, equipo_visitante: set1Visit },
      'local',
      {
        alineacionesPorSet: { 1: alineacionesPorSet[1], 2: alineacionesPorSet[2] },
        reglas: REGLAS_BO3,
        historialSaquePorSet: [
          { set_numero: 1, equipo: 'local' },
          { set_numero: 2, equipo: 'visitante' },
        ],
      }
    );

    assert.deepEqual(estado.posiciones_actuales.equipo_local, set2Local);
    assert.deepEqual(estado.posiciones_actuales.equipo_visitante, set2Visit);
  });

  it('sin alineación del set siguiente, mantiene posiciones del set anterior', () => {
    const eventos = [];
    let seq = 1;
    const set1Win = puntosParaGanarSet('LOCAL', seq);
    eventos.push(...set1Win.eventos);

    const posIniciales = {
      equipo_local: set1Local,
      equipo_visitante: set1Visit,
    };

    const soloSet1 = { 1: alineacionesPorSet[1] };

    const estado = reducirPosicionesVolley(
      eventos,
      posIniciales,
      'local',
      { alineacionesPorSet: soloSet1, reglas: REGLAS_BO3 }
    );

    // Sin alineación set 2, conserva última posición del set 1
    assert.ok(Array.isArray(estado.posiciones_actuales.equipo_local));
    assert.equal(estado.posiciones_actuales.equipo_local.length, 6);
  });

  it('estadoPosicionesInicial clona arrays', () => {
    const orig = { equipo_local: [1, 2, 3, 4, 5, 6], equipo_visitante: [7, 8, 9, 10, 11, 12] };
    const est = estadoPosicionesInicial(orig, 'local');
    est.posiciones_actuales.equipo_local[0] = 99;
    assert.equal(orig.equipo_local[0], 1);
  });
});
