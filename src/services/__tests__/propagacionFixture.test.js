import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  determinarTeamIdAvance,
  propagarAvancePartido
} from '../propagacionFixture.js';

const participantesPartido1 = [
  { partido_id: 1, team_id: 102, es_local: true },
  { partido_id: 1, team_id: 103, es_local: false }
];

const crearDepsMock = ({
  progresiones = [],
  participantesOrigen = participantesPartido1,
  participantesDestino = [],
  eventosPorPartido = {}
} = {}) => {
  const participantesAlmacenados = [...participantesDestino];
  let nextParticipanteId = participantesAlmacenados.length + 1;
  const transaction = { id: 'tx-mock' };

  return {
    ProgresionFixture: {
      findAll: async ({ where }) =>
        progresiones.filter((p) => p.partido_origen_id === where.partido_origen_id)
    },
    PartidoParticipantes: {
      findAll: async ({ where }) =>
        participantesOrigen.filter((p) => p.partido_id === where.partido_id),
      findOne: async ({ where }) =>
        participantesAlmacenados.find(
          (p) => p.partido_id === where.partido_id && p.es_local === where.es_local
        ) ?? null,
      create: async (payload) => {
        const registro = {
          id: nextParticipanteId,
          ...payload,
          update: async (cambios) => {
            Object.assign(registro, cambios);
            return registro;
          }
        };
        nextParticipanteId += 1;
        participantesAlmacenados.push(registro);
        return registro;
      }
    },
    EventosPartido: {
      count: async ({ where }) => eventosPorPartido[where.partido_id] ?? 0
    },
    sequelize: {
      transaction: async (callback) => callback(transaction)
    },
    _participantesDestino: participantesAlmacenados
  };
};

describe('determinarTeamIdAvance', () => {
  it('con GANADOR y resultado_principal 1 devuelve el team_id local', () => {
    assert.equal(
      determinarTeamIdAvance(participantesPartido1, 1, 'GANADOR'),
      102
    );
  });

  it('con GANADOR y resultado_principal -1 devuelve el team_id visitante', () => {
    assert.equal(
      determinarTeamIdAvance(participantesPartido1, -1, 'GANADOR'),
      103
    );
  });

  it('con PERDEDOR invierte el lado respecto al ganador', () => {
    assert.equal(
      determinarTeamIdAvance(participantesPartido1, 1, 'PERDEDOR'),
      103
    );
    assert.equal(
      determinarTeamIdAvance(participantesPartido1, -1, 'PERDEDOR'),
      102
    );
  });

  it('con resultado_principal 0 devuelve null', () => {
    assert.equal(
      determinarTeamIdAvance(participantesPartido1, 0, 'GANADOR'),
      null
    );
  });
});

describe('propagarAvancePartido', () => {
  it('propaga el ganador del partido 1 al partido 3 como VISITANTE (bracket de 6 equipos)', async () => {
    const deps = crearDepsMock({
      progresiones: [
        {
          partido_origen_id: 1,
          partido_destino_id: 3,
          condicion_avance: 'GANADOR',
          posicion_destino: 'VISITANTE'
        }
      ],
      participantesDestino: [
        { id: 10, partido_id: 3, team_id: 101, es_local: true }
      ]
    });

    const resultado = await propagarAvancePartido(1, 1, deps);

    assert.equal(resultado.error, undefined);
    assert.equal(resultado.propagaciones.length, 1);
    assert.deepEqual(resultado.propagaciones[0], {
      partido_destino_id: 3,
      team_id: 102,
      es_local: false,
      accion: 'creado'
    });

    const visitanteDestino = deps._participantesDestino.find(
      (p) => p.partido_id === 3 && p.es_local === false
    );
    assert.equal(visitanteDestino?.team_id, 102);
  });

  it('propaga PERDEDOR al lado indicado por posicion_destino', async () => {
    const deps = crearDepsMock({
      progresiones: [
        {
          partido_origen_id: 1,
          partido_destino_id: 99,
          condicion_avance: 'PERDEDOR',
          posicion_destino: 'LOCAL'
        }
      ]
    });

    const resultado = await propagarAvancePartido(1, 1, deps);

    assert.equal(resultado.error, undefined);
    assert.deepEqual(resultado.propagaciones[0], {
      partido_destino_id: 99,
      team_id: 103,
      es_local: true,
      accion: 'creado'
    });
  });

  it('sin filas en ProgresionFixture devuelve no-op', async () => {
    const deps = crearDepsMock({ progresiones: [] });

    const resultado = await propagarAvancePartido(1, 1, deps);

    assert.deepEqual(resultado, { propagaciones: [] });
    assert.equal(deps._participantesDestino.length, 0);
  });

  it('con resultado_principal 0 devuelve no-op sin consultar destino', async () => {
    let consultoProgresion = false;
    const deps = crearDepsMock();
    deps.ProgresionFixture.findAll = async () => {
      consultoProgresion = true;
      return [];
    };

    const resultado = await propagarAvancePartido(1, 0, deps);

    assert.deepEqual(resultado, { propagaciones: [] });
    assert.equal(consultoProgresion, false);
  });

  it('rechaza corregir avance si el partido destino ya tiene actividad registrada', async () => {
    const deps = crearDepsMock({
      progresiones: [
        {
          partido_origen_id: 1,
          partido_destino_id: 3,
          condicion_avance: 'GANADOR',
          posicion_destino: 'VISITANTE'
        }
      ],
      participantesDestino: [
        { id: 10, partido_id: 3, team_id: 103, es_local: false }
      ],
      eventosPorPartido: { 3: 2 }
    });

    const resultado = await propagarAvancePartido(1, 1, deps);

    assert.equal(
      resultado.error,
      'no se puede corregir el avance: el partido destino ya tiene actividad registrada'
    );
    assert.equal(
      deps._participantesDestino.find((p) => p.partido_id === 3 && p.es_local === false)?.team_id,
      103
    );
  });

  it('permite corregir team_id si el partido destino aún no tiene actividad', async () => {
    const existente = {
      id: 10,
      partido_id: 3,
      team_id: 103,
      es_local: false,
      update: async function actualizar(cambios) {
        Object.assign(this, cambios);
        return this;
      }
    };

    const deps = crearDepsMock({
      progresiones: [
        {
          partido_origen_id: 1,
          partido_destino_id: 3,
          condicion_avance: 'GANADOR',
          posicion_destino: 'VISITANTE'
        }
      ],
      participantesDestino: [existente],
      eventosPorPartido: { 3: 0 }
    });

    const resultado = await propagarAvancePartido(1, 1, deps);

    assert.equal(resultado.error, undefined);
    assert.deepEqual(resultado.propagaciones[0], {
      partido_destino_id: 3,
      team_id: 102,
      es_local: false,
      accion: 'actualizado'
    });
    assert.equal(existente.team_id, 102);
  });
});
