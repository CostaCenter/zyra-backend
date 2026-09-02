import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ordenarEventos,
  filtrarEventosValidos,
  reducirMarcador,
  reducirRotacion,
  reducirSanciones,
  reducirEstadoPartido,
  estadoMarcadorInicial,
  aplicarPunto,
  aplicarRotacion,
  aplicarSancion
} from '../reducerPartido.js';

function crearPunto(id, equipo, secuencia) {
  return {
    id,
    dispositivo_id: 'dev-1',
    secuencia_local: secuencia,
    ocurrido_en_cliente: `2026-01-01T10:${String(secuencia).padStart(2, '0')}:00Z`,
    tipo_evento: 'PUNTO',
    detalle_json: { equipo }
  };
}

function eventosHasta24a24() {
  const eventos = [];
  let secuencia = 1;

  for (let i = 0; i < 24; i++) {
    eventos.push(crearPunto(`l-${i + 1}`, 'LOCAL', secuencia++));
    eventos.push(crearPunto(`v-${i + 1}`, 'VISITANTE', secuencia++));
  }

  return eventos;
}

describe('ordenarEventos', () => {
  it('ordena por secuencia_local cuando los eventos son del mismo dispositivo', () => {
    const eventos = [
      {
        id: 'evt-3',
        dispositivo_id: 'dev-1',
        secuencia_local: 3,
        ocurrido_en_cliente: '2026-01-01T10:00:00Z',
        tipo_evento: 'PUNTO'
      },
      {
        id: 'evt-1',
        dispositivo_id: 'dev-1',
        secuencia_local: 1,
        ocurrido_en_cliente: '2026-01-01T10:00:00Z',
        tipo_evento: 'PUNTO'
      },
      {
        id: 'evt-2',
        dispositivo_id: 'dev-1',
        secuencia_local: 2,
        ocurrido_en_cliente: '2026-01-01T10:00:00Z',
        tipo_evento: 'PUNTO'
      }
    ];

    const ordenados = ordenarEventos(eventos);

    assert.deepEqual(
      ordenados.map((e) => e.id),
      ['evt-1', 'evt-2', 'evt-3']
    );
  });

  it('ordena por ocurrido_en_cliente cuando los eventos son de dispositivos distintos', () => {
    const eventos = [
      {
        id: 'evt-tarde',
        dispositivo_id: 'dev-2',
        secuencia_local: 1,
        ocurrido_en_cliente: '2026-01-01T12:00:00Z',
        tipo_evento: 'PUNTO'
      },
      {
        id: 'evt-temprano',
        dispositivo_id: 'dev-1',
        secuencia_local: 99,
        ocurrido_en_cliente: '2026-01-01T10:00:00Z',
        tipo_evento: 'PUNTO'
      }
    ];

    const ordenados = ordenarEventos(eventos);

    assert.deepEqual(
      ordenados.map((e) => e.id),
      ['evt-temprano', 'evt-tarde']
    );
  });
});

describe('filtrarEventosValidos', () => {
  it('mantiene un evento normal sin modificaciones en el resultado', () => {
    const eventos = [
      {
        id: 'evt-punto',
        dispositivo_id: 'dev-1',
        secuencia_local: 1,
        ocurrido_en_cliente: '2026-01-01T10:00:00Z',
        tipo_evento: 'PUNTO',
        detalle_json: { equipo: 'LOCAL' }
      }
    ];

    const validos = filtrarEventosValidos(eventos);

    assert.equal(validos.length, 1);
    assert.equal(validos[0].id, 'evt-punto');
  });

  it('elimina el evento anulado y la ANULACION_EVENTO que lo anuló', () => {
    const eventos = [
      {
        id: 'evt-punto',
        dispositivo_id: 'dev-1',
        secuencia_local: 1,
        ocurrido_en_cliente: '2026-01-01T10:00:00Z',
        tipo_evento: 'PUNTO',
        detalle_json: { equipo: 'LOCAL' }
      },
      {
        id: 'evt-anulacion',
        dispositivo_id: 'dev-1',
        secuencia_local: 2,
        ocurrido_en_cliente: '2026-01-01T10:01:00Z',
        tipo_evento: 'ANULACION_EVENTO',
        detalle_json: { evento_anulado_id: 'evt-punto' }
      },
      {
        id: 'evt-otro',
        dispositivo_id: 'dev-1',
        secuencia_local: 3,
        ocurrido_en_cliente: '2026-01-01T10:02:00Z',
        tipo_evento: 'PUNTO',
        detalle_json: { equipo: 'VISITANTE' }
      }
    ];

    const validos = filtrarEventosValidos(eventos);

    assert.deepEqual(
      validos.map((e) => e.id),
      ['evt-otro']
    );
  });

  it('ignora una segunda anulación sobre el mismo evento_anulado_id (no revive el evento)', () => {
    const eventos = [
      {
        id: 'evt-punto',
        dispositivo_id: 'dev-1',
        secuencia_local: 1,
        ocurrido_en_cliente: '2026-01-01T10:00:00Z',
        tipo_evento: 'PUNTO',
        detalle_json: { equipo: 'LOCAL' }
      },
      {
        id: 'evt-anulacion-1',
        dispositivo_id: 'dev-1',
        secuencia_local: 2,
        ocurrido_en_cliente: '2026-01-01T10:01:00Z',
        tipo_evento: 'ANULACION_EVENTO',
        detalle_json: { evento_anulado_id: 'evt-punto' }
      },
      {
        id: 'evt-anulacion-2',
        dispositivo_id: 'dev-1',
        secuencia_local: 3,
        ocurrido_en_cliente: '2026-01-01T10:02:00Z',
        tipo_evento: 'ANULACION_EVENTO',
        detalle_json: { evento_anulado_id: 'evt-punto' }
      },
      {
        id: 'evt-sigue',
        dispositivo_id: 'dev-1',
        secuencia_local: 4,
        ocurrido_en_cliente: '2026-01-01T10:03:00Z',
        tipo_evento: 'PUNTO',
        detalle_json: { equipo: 'VISITANTE' }
      }
    ];

    const validos = filtrarEventosValidos(eventos);

    assert.deepEqual(
      validos.map((e) => e.id),
      ['evt-sigue']
    );
    assert.ok(!validos.some((e) => e.id === 'evt-punto'));
  });
});

const reglasVoley = {
  puntos_por_set: 25,
  ventaja_obligatoria: 2,
  sets_para_ganar: 3
};

describe('stubs — sub-reducers y reducer principal', () => {
  it('reducirMarcador acumula un punto LOCAL ignorando eventos que no son PUNTO', () => {
    const eventos = [
      {
        id: 'evt-1',
        tipo_evento: 'PUNTO',
        detalle_json: { equipo: 'LOCAL' }
      },
      {
        id: 'evt-2',
        tipo_evento: 'CAMBIO',
        detalle_json: {}
      }
    ];

    const marcador = reducirMarcador(eventos, reglasVoley);

    assert.equal(marcador.puntos_favor, 1);
    assert.equal(marcador.puntos_contra, 0);
    assert.equal(marcador.sets_ganados_local, 0);
  });

  it('reducirRotacion aplica ROTACION explícita e ignora PUNTO en formación', () => {
    const formacionInicial = [1, 2, 3, 4, 5, 6];
    const nuevaFormacion = [6, 1, 2, 3, 4, 5];
    const eventos = [
      { id: 'evt-1', tipo_evento: 'PUNTO', detalle_json: { equipo: 'LOCAL' } },
      { id: 'evt-2', tipo_evento: 'ROTACION', detalle_json: { nueva_formacion: nuevaFormacion } }
    ];

    const rotacion = reducirRotacion(eventos, formacionInicial);

    assert.deepEqual(rotacion, {
      formacion_actual: nuevaFormacion,
      jugador_al_saque: 6
    });
  });

  it('reducirSanciones acumula tarjetas válidas de eventos SANCION', () => {
    const eventos = [
      {
        id: 'evt-1',
        tipo_evento: 'SANCION',
        actor_principal_id: 10,
        detalle_json: { tarjeta: 'AMARILLA' }
      },
      { id: 'evt-2', tipo_evento: 'PUNTO', detalle_json: { equipo: 'LOCAL' } }
    ];

    const sanciones = reducirSanciones(eventos);

    assert.deepEqual(sanciones, {
      tarjetas: [{ jugador_id: 10, tipo: 'AMARILLA', evento_id: 'evt-1' }]
    });
  });

  it('reducirEstadoPartido orquesta orden, filtrado y sub-reducers stub', () => {
    const formacionInicial = [10, 11, 12, 13, 14, 15];
    const eventos = [
      {
        id: 'evt-punto',
        dispositivo_id: 'dev-1',
        secuencia_local: 1,
        ocurrido_en_cliente: '2026-01-01T10:00:00Z',
        tipo_evento: 'PUNTO',
        detalle_json: { equipo: 'LOCAL' }
      },
      {
        id: 'evt-anulacion',
        dispositivo_id: 'dev-1',
        secuencia_local: 2,
        ocurrido_en_cliente: '2026-01-01T10:01:00Z',
        tipo_evento: 'ANULACION_EVENTO',
        detalle_json: { evento_anulado_id: 'evt-punto' }
      },
      {
        id: 'evt-sancion',
        dispositivo_id: 'dev-1',
        secuencia_local: 3,
        ocurrido_en_cliente: '2026-01-01T10:02:00Z',
        tipo_evento: 'SANCION',
        actor_principal_id: 42,
        detalle_json: { tarjeta: 'AMARILLA' }
      }
    ];

    const estado = reducirEstadoPartido(eventos, reglasVoley, formacionInicial);

    assert.deepEqual(estado.marcador, estadoMarcadorInicial());
    assert.deepEqual(estado.rotacion, {
      formacion_actual: formacionInicial,
      jugador_al_saque: 10
    });
    assert.deepEqual(estado.sanciones, {
      tarjetas: [{ jugador_id: 42, tipo: 'AMARILLA', evento_id: 'evt-sancion' }]
    });
    assert.equal(estado.ultimo_evento_id_procesado, 'evt-sancion');
  });

  it('reducirEstadoPartido con snapshotPrevio solo procesa eventos posteriores', () => {
    const eventos = [
      {
        id: 'evt-1',
        dispositivo_id: 'dev-1',
        secuencia_local: 1,
        ocurrido_en_cliente: '2026-01-01T10:00:00Z',
        tipo_evento: 'PUNTO',
        detalle_json: { equipo: 'LOCAL' }
      },
      {
        id: 'evt-2',
        dispositivo_id: 'dev-1',
        secuencia_local: 2,
        ocurrido_en_cliente: '2026-01-01T10:01:00Z',
        tipo_evento: 'SANCION',
        actor_principal_id: 99,
        detalle_json: { tarjeta: 'ROJA' }
      }
    ];

    const estado = reducirEstadoPartido(
      eventos,
      reglasVoley,
      [1, 2, 3, 4, 5, 6],
      { ultimo_evento_id_procesado: 'evt-1' }
    );

    assert.equal(estado.ultimo_evento_id_procesado, 'evt-2');
    assert.deepEqual(estado.marcador, estadoMarcadorInicial());
    assert.deepEqual(estado.sanciones, {
      tarjetas: [{ jugador_id: 99, tipo: 'ROJA', evento_id: 'evt-2' }]
    });
  });
});

describe('aplicarPunto — ventaja obligatoria y cierre de set', () => {
  it('no cierra en 25-24, empata 25-25, y cierra en 27-25 con ventaja de 2', () => {
    let secuencia = 49;
    const eventos = [
      ...eventosHasta24a24(),
      crearPunto('p-25-local', 'LOCAL', secuencia++),
      crearPunto('p-25-visit', 'VISITANTE', secuencia++),
      crearPunto('p-26-local', 'LOCAL', secuencia++),
      crearPunto('p-27-local', 'LOCAL', secuencia++)
    ];

    const tras25_24 = reducirMarcador(eventos.slice(0, 49), reglasVoley);
    assert.equal(tras25_24.puntos_favor, 25);
    assert.equal(tras25_24.puntos_contra, 24);
    assert.equal(tras25_24.sets_ganados_local, 0);
    assert.equal(tras25_24.sets_ganados_visitante, 0);

    const tras25_25 = reducirMarcador(eventos.slice(0, 50), reglasVoley);
    assert.equal(tras25_25.puntos_favor, 25);
    assert.equal(tras25_25.puntos_contra, 25);
    assert.equal(tras25_25.sets_ganados_local, 0);

    const tras26_25 = reducirMarcador(eventos.slice(0, 51), reglasVoley);
    assert.equal(tras26_25.puntos_favor, 26);
    assert.equal(tras26_25.puntos_contra, 25);
    assert.equal(tras26_25.sets_ganados_local, 0);

    const final = reducirMarcador(eventos, reglasVoley);
    assert.equal(final.sets_ganados_local, 1);
    assert.equal(final.sets_ganados_visitante, 0);
    assert.equal(final.puntos_favor, 0);
    assert.equal(final.puntos_contra, 0);
    assert.deepEqual(final.metrica_estructura.parciales_sets, [[27, 25]]);
  });

  it('integración: anulación del empate 25-25 hace que LOCAL cierre el set en 26-24', () => {
    let secuencia = 49;
    const eventos = [
      ...eventosHasta24a24(),
      crearPunto('p-25-local', 'LOCAL', secuencia++),
      crearPunto('p-25-visit', 'VISITANTE', secuencia++),
      {
        id: 'anula-25-visit',
        dispositivo_id: 'dev-1',
        secuencia_local: secuencia++,
        ocurrido_en_cliente: '2026-01-01T10:51:00Z',
        tipo_evento: 'ANULACION_EVENTO',
        detalle_json: { evento_anulado_id: 'p-25-visit' }
      },
      crearPunto('p-26-local', 'LOCAL', secuencia++)
    ];

    const estado = reducirEstadoPartido(eventos, reglasVoley, [1, 2, 3, 4, 5, 6]);

    assert.equal(estado.marcador.sets_ganados_local, 1);
    assert.equal(estado.marcador.sets_ganados_visitante, 0);
    assert.equal(estado.marcador.puntos_favor, 0);
    assert.equal(estado.marcador.puntos_contra, 0);
    assert.deepEqual(estado.marcador.metrica_estructura.parciales_sets, [[26, 24]]);
  });

  it('ignora un equipo inválido en detalle_json sin modificar el estado', () => {
    const estado = estadoMarcadorInicial();
    const evento = {
      id: 'evt-invalido',
      tipo_evento: 'PUNTO',
      detalle_json: { equipo: 'XYZ' }
    };

    const resultado = aplicarPunto(estado, evento, reglasVoley);

    assert.deepEqual(resultado, estado);
  });
});

describe('aplicarRotacion', () => {
  it('actualiza formacion_actual y jugador_al_saque con un evento ROTACION', () => {
    const estado = {
      formacion_actual: [1, 2, 3, 4, 5, 6],
      jugador_al_saque: 1
    };
    const evento = {
      tipo_evento: 'ROTACION',
      detalle_json: { nueva_formacion: [6, 1, 2, 3, 4, 5] }
    };

    const resultado = aplicarRotacion(estado, evento);

    assert.deepEqual(resultado.formacion_actual, [6, 1, 2, 3, 4, 5]);
    assert.equal(resultado.jugador_al_saque, 6);
  });

  it('un evento PUNTO no modifica la rotación', () => {
    const estado = {
      formacion_actual: [1, 2, 3, 4, 5, 6],
      jugador_al_saque: 1
    };
    const evento = {
      tipo_evento: 'PUNTO',
      detalle_json: { equipo: 'LOCAL' }
    };

    const resultado = aplicarRotacion(estado, evento);

    assert.deepEqual(resultado, estado);
  });
});

describe('aplicarSancion', () => {
  it('agrega una tarjeta amarilla correctamente al array', () => {
    const estado = { tarjetas: [] };
    const evento = {
      id: 'evt-amarilla',
      actor_principal_id: 7,
      detalle_json: { tarjeta: 'AMARILLA' }
    };

    const resultado = aplicarSancion(estado, evento);

    assert.deepEqual(resultado, {
      tarjetas: [{ jugador_id: 7, tipo: 'AMARILLA', evento_id: 'evt-amarilla' }]
    });
    assert.equal(estado.tarjetas.length, 0);
  });

  it('acumula tarjetas de jugadores distintos sin sobrescribir', () => {
    const estado = {
      tarjetas: [{ jugador_id: 7, tipo: 'AMARILLA', evento_id: 'evt-1' }]
    };
    const evento = {
      id: 'evt-2',
      actor_principal_id: 12,
      detalle_json: { tarjeta: 'ROJA' }
    };

    const resultado = aplicarSancion(estado, evento);

    assert.deepEqual(resultado, {
      tarjetas: [
        { jugador_id: 7, tipo: 'AMARILLA', evento_id: 'evt-1' },
        { jugador_id: 12, tipo: 'ROJA', evento_id: 'evt-2' }
      ]
    });
    assert.equal(estado.tarjetas.length, 1);
  });

  it('ignora un valor de tarjeta inválido sin modificar el estado', () => {
    const estado = {
      tarjetas: [{ jugador_id: 7, tipo: 'AMARILLA', evento_id: 'evt-1' }]
    };
    const evento = {
      id: 'evt-invalido',
      actor_principal_id: 12,
      detalle_json: { tarjeta: 'AZUL' }
    };

    const resultado = aplicarSancion(estado, evento);

    assert.deepEqual(resultado, estado);
    assert.equal(estado.tarjetas.length, 1);
  });
});
