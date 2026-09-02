import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularDuracionEstimadaPartidoMinutos,
  calcularMaxSetsPartido,
  calcularDescansoMinimoEntrePartidos,
} from '../torneoConfigService.js';

describe('Duración estimada del partido (caso completo)', () => {
  it('mejor de 3 (sets_para_ganar=2): 3 sets + 2 descansos', () => {
    assert.equal(calcularMaxSetsPartido(2), 3);
    assert.equal(
      calcularDuracionEstimadaPartidoMinutos({
        setsParaGanar: 2,
        duracionPromedioSetMinutos: 30,
        descansoEntreSetsMinutos: 5,
      }),
      100
    );
  });

  it('mejor de 5 (sets_para_ganar=3): 5 sets + 4 descansos', () => {
    assert.equal(calcularMaxSetsPartido(3), 5);
    assert.equal(
      calcularDuracionEstimadaPartidoMinutos({
        setsParaGanar: 3,
        duracionPromedioSetMinutos: 30,
        descansoEntreSetsMinutos: 5,
      }),
      170
    );
  });

  it('descanso mínimo entre partidos: descanso_entre_sets × 3, acotado 15–20 min', () => {
    assert.equal(calcularDescansoMinimoEntrePartidos(5), 15);
    assert.equal(calcularDescansoMinimoEntrePartidos(6), 18);
    assert.equal(calcularDescansoMinimoEntrePartidos(7), 20);
    assert.equal(calcularDescansoMinimoEntrePartidos(3), 15);
  });
});
