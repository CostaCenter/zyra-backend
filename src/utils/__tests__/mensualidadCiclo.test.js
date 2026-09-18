import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularDiaCorteMensual,
  calcularPrimeraFechaCorte,
  calcularSiguienteFechaCorteMensual,
  fechaCorteEnMes,
  siguienteFechaCorteMensual,
} from '../mensualidadCiclo.js';

describe('mensualidadCiclo', () => {
  it('primera fecha de corte = fecha_ingreso + dias_gracia', () => {
    assert.equal(calcularPrimeraFechaCorte('2026-01-01', 30), '2026-01-31');
    assert.equal(calcularPrimeraFechaCorte('2026-03-15', 0), '2026-03-15');
  });

  it('ancla el día del mes desde la primera fecha de corte', () => {
    assert.equal(calcularDiaCorteMensual('2026-01-01', 30), 31);
    assert.equal(calcularDiaCorteMensual('2026-03-10', 5), 15);
  });

  it('corte 31 ene → feb 28 (no bisiesto) → mar 31 (no queda en 28)', () => {
    const primera = calcularPrimeraFechaCorte('2026-01-01', 30);
    assert.equal(primera, '2026-01-31');

    const segundo = siguienteFechaCorteMensual(primera, 31);
    assert.equal(segundo, '2026-02-28');

    const tercero = siguienteFechaCorteMensual(segundo, 31);
    assert.equal(tercero, '2026-03-31');
  });

  it('corte 31 ene → feb 29 en año bisiesto → mar 31', () => {
    const primera = calcularPrimeraFechaCorte('2024-01-01', 30);
    assert.equal(primera, '2024-01-31');

    const segundo = siguienteFechaCorteMensual(primera, 31);
    assert.equal(segundo, '2024-02-29');

    const tercero = siguienteFechaCorteMensual(segundo, 31);
    assert.equal(tercero, '2024-03-31');
  });

  it('ajusta al último día del mes cuando el día fijo no existe', () => {
    assert.equal(fechaCorteEnMes(2026, 2, 31), '2026-02-28');
    assert.equal(fechaCorteEnMes(2026, 4, 31), '2026-04-30');
    assert.equal(fechaCorteEnMes(2026, 3, 31), '2026-03-31');
  });

  it('calcularSiguienteFechaCorteMensual sin historial devuelve la primera', () => {
    assert.equal(
      calcularSiguienteFechaCorteMensual('2026-01-01', 30, null),
      '2026-01-31',
    );
  });

  it('calcularSiguienteFechaCorteMensual con último corte avanza un mes anclado', () => {
    assert.equal(
      calcularSiguienteFechaCorteMensual('2026-01-01', 30, '2026-01-31'),
      '2026-02-28',
    );
    assert.equal(
      calcularSiguienteFechaCorteMensual('2026-01-01', 30, '2026-02-28'),
      '2026-03-31',
    );
  });
});
