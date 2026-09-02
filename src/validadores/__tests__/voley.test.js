import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarSustitucionVoley,
  construirEstadoSustituciones,
  LIMITE_SUSTITUCIONES_POR_SET_DEFAULT,
  motivoLimiteSustituciones,
} from '../voley.js';

const X = 10;
const Y = 20;
const Z = 30;

function cambio(salienteId, entranteId) {
  return { saliente_id: salienteId, entrante_id: entranteId };
}

const nombres = {
  [Y]: 'Suplente Y',
  [X]: 'Titular X',
  [Z]: 'Suplente Z',
};

describe('construirEstadoSustituciones', () => {
  it('X→Y vincula Y con X', () => {
    const estado = construirEstadoSustituciones([cambio(X, Y)]);
    assert.equal(estado.sustitucionesUsadas, 1);
    assert.equal(estado.suplenteRequiereTitular.get(Y), X);
  });

  it('X→Y luego Y→X libera la pareja', () => {
    const estado = construirEstadoSustituciones([cambio(X, Y), cambio(Y, X)]);
    assert.equal(estado.suplenteRequiereTitular.size, 0);
  });
});

describe('validarSustitucionVoley', () => {
  it('primer cambio X→Y es válido (sin límite activo)', () => {
    assert.deepEqual(validarSustitucionVoley([], X, Y), {
      valido: true,
      sustitucionesUsadas: 0,
      sustitucionesRestantes: null,
    });
  });

  it('(a) intentar Y→Z se bloquea tras X→Y', () => {
    const historial = [cambio(X, Y)];
    const resultado = validarSustitucionVoley(historial, Y, Z, nombres);

    assert.equal(resultado.valido, false);
    assert.equal(
      resultado.motivo,
      'Suplente Y solo puede ser reemplazado por Titular X (su titular original)'
    );
  });

  it('Y→X es válido tras X→Y (retorno del titular)', () => {
    const historial = [cambio(X, Y)];
    assert.deepEqual(validarSustitucionVoley(historial, Y, X), {
      valido: true,
      sustitucionesUsadas: 1,
      sustitucionesRestantes: null,
    });
  });

  it('(b) X→Y, Y→X y X→Y de nuevo se permite y cuenta 3 sustituciones usadas', () => {
    const historial = [cambio(X, Y), cambio(Y, X), cambio(X, Y)];

    assert.equal(historial.length, 3);

    const estado = construirEstadoSustituciones(historial);
    assert.equal(estado.sustitucionesUsadas, 3);
    assert.equal(estado.suplenteRequiereTitular.get(Y), X);

    const cuarto = validarSustitucionVoley(historial, Y, X);
    assert.deepEqual(cuarto, {
      valido: true,
      sustitucionesUsadas: 3,
      sustitucionesRestantes: null,
    });
  });

  it('tras X→Y, Y→X, X puede formar pareja nueva X→Z', () => {
    const historial = [cambio(X, Y), cambio(Y, X)];
    const resultado = validarSustitucionVoley(historial, X, Z);

    assert.deepEqual(resultado, {
      valido: true,
      sustitucionesUsadas: 2,
      sustitucionesRestantes: null,
    });

    const trasNuevaPareja = construirEstadoSustituciones([...historial, cambio(X, Z)]);
    assert.equal(trasNuevaPareja.suplenteRequiereTitular.get(Z), X);
  });

  it('(c) sin límite activo, la séptima sustitución sigue siendo válida', () => {
    const historial = [
      cambio(X, Y),
      cambio(Y, X),
      cambio(X, Y),
      cambio(Y, X),
      cambio(X, Y),
      cambio(Y, X),
    ];

    const septima = validarSustitucionVoley(historial, X, Y);
    assert.deepEqual(septima, {
      valido: true,
      sustitucionesUsadas: 6,
      sustitucionesRestantes: null,
    });
  });

  it('con límite explícito de 6, la séptima se bloquea (reactivable por torneo)', () => {
    const historial = [
      cambio(X, Y),
      cambio(Y, X),
      cambio(X, Y),
      cambio(Y, X),
      cambio(X, Y),
      cambio(Y, X),
    ];

    const septima = validarSustitucionVoley(
      historial,
      X,
      Y,
      {},
      LIMITE_SUSTITUCIONES_POR_SET_DEFAULT
    );

    assert.deepEqual(septima, {
      valido: false,
      motivo: motivoLimiteSustituciones(LIMITE_SUSTITUCIONES_POR_SET_DEFAULT),
    });
  });
});
