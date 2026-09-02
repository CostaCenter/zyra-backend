import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolverClaveAccionDesdeEvento,
  resolverJugadorIdDesdeEvento,
} from '../puntosPersonalesService.js';
import {
  calcularFactorMargen,
  calcularDeltaElo,
} from '../ratingEquipoService.js';
import { ajustarPromedioPorExperiencia, MIN_PARTIDOS_FUERZA_PLENA } from '../fuerzaEquipoService.js';

describe('resolverClaveAccionDesdeEvento', () => {
  it('lee tipo_accion del detalle sin lógica por deporte', () => {
    const evento = {
      tipo_evento: 'PUNTO',
      detalle_json: { tipo_accion: 'ataque', jugador_id: 5 },
    };
    assert.equal(resolverClaveAccionDesdeEvento(evento), 'ATAQUE');
  });

  it('ignora eventos sin tipo_accion', () => {
    const evento = {
      tipo_evento: 'PUNTO',
      detalle_json: { origen: 'JUGADOR', jugador_id: 5 },
    };
    assert.equal(resolverClaveAccionDesdeEvento(evento), null);
  });

  it('ignora tipos distintos a PUNTO', () => {
    assert.equal(
      resolverClaveAccionDesdeEvento({ tipo_evento: 'SANCION', detalle_json: { tipo_accion: 'GOL' } }),
      null
    );
  });
});

describe('resolverJugadorIdDesdeEvento', () => {
  it('prioriza jugador_id en detalle_json', () => {
    const evento = {
      actor_principal_id: 99,
      detalle_json: { jugador_id: 7, origen: 'JUGADOR' },
    };
    assert.equal(resolverJugadorIdDesdeEvento(evento), 7);
  });
});

describe('calcularPuntosPersonales (lógica pura)', () => {
  it('suma solo acciones configuradas para el deporte', async () => {
    const { calcularPuntosPersonales } = await import('../puntosPersonalesService.js');

    const eventosValidos = [
      {
        id: '1',
        tipo_evento: 'PUNTO',
        actor_principal_id: 10,
        detalle_json: { jugador_id: 10, tipo_accion: 'ATAQUE' },
      },
      {
        id: '2',
        tipo_evento: 'PUNTO',
        actor_principal_id: 10,
        detalle_json: { jugador_id: 10, tipo_accion: 'BLOQUEO' },
      },
      {
        id: '3',
        tipo_evento: 'PUNTO',
        actor_principal_id: 10,
        detalle_json: { jugador_id: 10, tipo_accion: 'GOL_FUTBOL' },
      },
      {
        id: '4',
        tipo_evento: 'PUNTO',
        actor_principal_id: 10,
        detalle_json: { jugador_id: 10 },
      },
    ];

    const mapaValores = new Map([
      ['ATAQUE', 2],
      ['BLOQUEO', 3],
    ]);

    const total = await calcularPuntosPersonales(1, 10, {
      sportId: 2,
      eventosValidos,
      mapaValores,
    });

    assert.equal(total, 6);
  });

  it('suma 1 punto personal por defecto si no hay tipo_accion', async () => {
    const { calcularPuntosPersonales } = await import('../puntosPersonalesService.js');

    const eventosValidos = [
      {
        id: '1',
        tipo_evento: 'PUNTO',
        actor_principal_id: 10,
        detalle_json: { jugador_id: 10, origen: 'JUGADOR' },
      },
    ];

    const total = await calcularPuntosPersonales(1, 10, {
      sportId: 2,
      eventosValidos,
      mapaValores: new Map(),
    });

    assert.equal(total, 1);
  });
});

describe('ajustarPromedioPorExperiencia', () => {
  it(`usa valor pleno con ${MIN_PARTIDOS_FUERZA_PLENA}+ partidos`, () => {
    assert.equal(ajustarPromedioPorExperiencia(8, 3, 4), 8);
  });

  it('mezcla con promedio de liga si hay menos partidos', () => {
    const ajustado = ajustarPromedioPorExperiencia(9, 1, 3);
    assert.equal(ajustado, 5);
  });
});

describe('ratingEquipoService', () => {
  it('aumenta el factor de K con mayor margen', () => {
    assert.ok(calcularFactorMargen(20) > calcularFactorMargen(2));
  });

  it('premia más al underdog que gana que al favorito', () => {
    const deltaUnderdog = calcularDeltaElo(150, 200, 15);
    const deltaFavorite = calcularDeltaElo(200, 150, 15);
    assert.ok(deltaUnderdog > deltaFavorite);
  });
});
