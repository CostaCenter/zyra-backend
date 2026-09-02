import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  alternarEquipoSaca,
  calcularSaqueAutomaticoSiguienteSet,
  esSetDecisivoPorMarcador,
  requiereSorteoManualSaque,
  resolverSaqueSetVolley,
} from '../saquePorSetService.js';

const REGLAS_BO5 = { sets_para_ganar: 3, puntos_por_set: 25, ventaja_obligatoria: 2 };

const marcadorEntreSets = (setsCompletados, setsLocal, setsVisitante) => ({
  resultado_principal: 0,
  sets_ganados_local: setsLocal,
  sets_ganados_visitante: setsVisitante,
  puntos_favor: 0,
  puntos_contra: 0,
  metrica_estructura: {
    parciales_sets: Array.from({ length: setsCompletados }, () => [25, 20]),
  },
});

describe('saquePorSetService', () => {
  it('alternarEquipoSaca invierte local/visitante', () => {
    assert.equal(alternarEquipoSaca('local'), 'visitante');
    assert.equal(alternarEquipoSaca('visitante'), 'local');
  });

  it('set 5 es decisivo con marcador 2-2 en bo5', () => {
    assert.equal(esSetDecisivoPorMarcador(2, 2, REGLAS_BO5), true);
    assert.equal(esSetDecisivoPorMarcador(2, 1, REGLAS_BO5), false);
  });

  it('requiere sorteo manual en set 1 y set decisivo', () => {
    assert.equal(requiereSorteoManualSaque(1, 0, 0, REGLAS_BO5), true);
    assert.equal(requiereSorteoManualSaque(2, 1, 0, REGLAS_BO5), false);
    assert.equal(requiereSorteoManualSaque(5, 2, 2, REGLAS_BO5), true);
  });

  describe('partido a 5 sets — Equipo A = local', () => {
    const equipoA = 'local';
    const equipoB = 'visitante';
    const reglas = REGLAS_BO5;
    let historial = [];

    it('set 1: sorteo manual → Equipo A (local)', () => {
      const marcador = marcadorEntreSets(0, 0, 0);
      const res = resolverSaqueSetVolley({
        marcador,
        posicionesVolleyEquipoQueSaca: equipoA,
        reglas,
        equipoQueSacaInicialPartido: equipoA,
        historialPrevio: historial,
      });

      assert.equal(res.equipo_que_saca, equipoA);
      assert.equal(res.pendiente_saque_set, null);
      assert.deepEqual(res.historial, [{ set_numero: 1, equipo: equipoA }]);
      historial = res.historial;
    });

    it('set 2: automático → Equipo B (visitante)', () => {
      const marcador = marcadorEntreSets(1, 1, 0);
      const res = resolverSaqueSetVolley({
        marcador,
        posicionesVolleyEquipoQueSaca: equipoA,
        reglas,
        equipoQueSacaInicialPartido: equipoA,
        historialPrevio: historial,
      });

      assert.equal(res.equipo_que_saca, equipoB);
      assert.equal(res.pendiente_saque_set, null);
      historial = res.historial;
    });

    it('set 3: automático → Equipo A (local)', () => {
      const marcador = marcadorEntreSets(2, 1, 1);
      const res = resolverSaqueSetVolley({
        marcador,
        posicionesVolleyEquipoQueSaca: equipoB,
        reglas,
        equipoQueSacaInicialPartido: equipoA,
        historialPrevio: historial,
      });

      assert.equal(res.equipo_que_saca, equipoA);
      assert.equal(res.pendiente_saque_set, null);
      historial = res.historial;
    });

    it('set 4: automático → Equipo B (visitante)', () => {
      const marcador = marcadorEntreSets(3, 2, 1);
      const res = resolverSaqueSetVolley({
        marcador,
        posicionesVolleyEquipoQueSaca: equipoA,
        reglas,
        equipoQueSacaInicialPartido: equipoA,
        historialPrevio: historial,
      });

      assert.equal(res.equipo_que_saca, equipoB);
      assert.equal(res.pendiente_saque_set, null);
      historial = res.historial;
    });

    it('set 5: pendiente sorteo manual del árbitro (2-2)', () => {
      const marcador = marcadorEntreSets(4, 2, 2);
      const res = resolverSaqueSetVolley({
        marcador,
        posicionesVolleyEquipoQueSaca: equipoB,
        reglas,
        equipoQueSacaInicialPartido: equipoA,
        historialPrevio: historial,
      });

      assert.equal(res.pendiente_saque_set, 5);
      assert.equal(res.historial.length, 4);
      historial = res.historial;
    });

    it('set 5: tras elección manual del árbitro (visitante)', () => {
      const marcador = marcadorEntreSets(4, 2, 2);
      historial = [...historial, { set_numero: 5, equipo: equipoB }];

      const res = resolverSaqueSetVolley({
        marcador,
        posicionesVolleyEquipoQueSaca: equipoB,
        reglas,
        equipoQueSacaInicialPartido: equipoA,
        historialPrevio: historial,
        pendienteSaqueSetPrevio: null,
      });

      assert.equal(res.equipo_que_saca, equipoB);
      assert.equal(res.pendiente_saque_set, null);
      assert.deepEqual(
        res.historial.map((e) => e.equipo),
        [equipoA, equipoB, equipoA, equipoB, equipoB]
      );
    });
  });

  it('calcularSaqueAutomaticoSiguienteSet alterna desde historial', () => {
    const historial = [
      { set_numero: 1, equipo: 'local' },
      { set_numero: 2, equipo: 'visitante' },
      { set_numero: 3, equipo: 'local' },
    ];
    assert.equal(calcularSaqueAutomaticoSiguienteSet(historial), 'visitante');
  });
});
