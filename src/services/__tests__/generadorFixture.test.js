import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generarRoundRobin,
  generarParesRoundRobin,
  generarJornadasCircleMethod,
  generarEliminacionDirecta,
  calcularTamanoBracket
} from '../generadorFixture.js';
import {
  fisherYatesShuffle,
  crearRandomDesdeSemilla,
  mezclarEquiposSorteo,
} from '../../utils/sorteoAleatorio.js';

const FASE_ID = 10;
const TORNEO_ID = 1;
const SPORT_ID = 3;

const crearFaseMock = () => ({
  id: FASE_ID,
  torneo_id: TORNEO_ID,
  torneo: {
    id: TORNEO_ID,
    sport_id: SPORT_ID,
    nivel_arbitraje_default: 'BASICO'
  }
});

const crearDepsMock = (overrides = {}) => {
  let partidoId = 0;
  const partidosCreados = [];
  const participantesCreados = [];
  const progresionesCreadas = [];

  const transaction = { id: 'tx-mock', LOCK: { UPDATE: 'UPDATE' } };
  let ordenSorteoGuardado = { sorteos: [] };

  const deps = {
    FaseTorneo: {
      findByPk: async () => crearFaseMock()
    },
    Torneos: {
      findByPk: async () => ({
        id: TORNEO_ID,
        orden_sorteo: ordenSorteoGuardado,
        numero_canchas: 1,
        tipo_duracion: 'RELAMPAGO',
        descanso_minimo_minutos: 30,
        duracion_promedio_set_minutos: 30,
        descanso_entre_sets_minutos: 5,
        reglas_arbitraje_json: { sets_para_ganar: 2 },
        hora_inicio_diaria: '08:00:00',
        hora_fin_diaria: '22:00:00',
        update: async (data) => {
          ordenSorteoGuardado = data.orden_sorteo;
          return { orden_sorteo: ordenSorteoGuardado };
        },
      }),
    },
    TorneoInscripcion: {
      findAll: async () => []
    },
    Partidos: {
      count: async () => 0,
      create: async (payload, options) => {
        partidoId += 1;
        const partido = {
          id: partidoId,
          ...payload,
          toJSON() {
            return { id: this.id, ...payload };
          }
        };
        partidosCreados.push({ partido, payload, options });
        return partido;
      },
      update: async () => [1],
    },
    PartidoParticipantes: {
      create: async (payload, options) => {
        participantesCreados.push({ payload, options });
        return { id: participantesCreados.length, ...payload };
      },
      findAll: async ({ where }) => {
        const ids = where?.partido_id;
        const idSet = Array.isArray(ids) ? new Set(ids) : new Set([ids]);
        return participantesCreados
          .filter(({ payload }) => idSet.has(payload.partido_id))
          .map(({ payload }) => ({
            partido_id: payload.partido_id,
            team_id: payload.team_id,
            es_local: payload.es_local,
          }));
      },
    },
    ProgresionFixture: {
      create: async (payload, options) => {
        progresionesCreadas.push({ payload, options });
        return {
          id: progresionesCreadas.length,
          ...payload,
          toJSON() {
            return { id: this.id, ...payload };
          }
        };
      }
    },
    sequelize: {
      transaction: async (callback) => callback(transaction)
    },
    ...overrides,
    _partidosCreados: partidosCreados,
    _participantesCreados: participantesCreados,
    _progresionesCreadas: progresionesCreadas,
    get _ordenSorteoGuardado() {
      return ordenSorteoGuardado;
    },
  };

  return deps;
};

describe('generarParesRoundRobin', () => {
  it('genera C(4,2) = 6 pares únicos para 4 equipos', () => {
    const pares = generarParesRoundRobin([1, 2, 3, 4]);
    assert.equal(pares.length, 6);
    assert.deepEqual(pares[0], [1, 2]);
    assert.deepEqual(pares[5], [3, 4]);
  });
});

describe('sorteoAleatorio', () => {
  it('mezclarEquiposSorteo es determinista con la misma semilla', () => {
    const semilla = Buffer.from('a'.repeat(32));
    const ids = [1, 2, 3, 4, 5, 6, 7, 8];

    const a = mezclarEquiposSorteo(ids, semilla);
    const b = mezclarEquiposSorteo(ids, semilla);

    assert.deepEqual(a.equipos, b.equipos);
    assert.notDeepEqual(a.equipos, ids);
    assert.equal(a.semilla_hex, semilla.toString('hex'));
  });

  it('fisherYatesShuffle no deja elementos fuera del arreglo', () => {
    const ids = [10, 20, 30, 40];
    const random = crearRandomDesdeSemilla(Buffer.from('b'.repeat(32)));
    const mezclado = fisherYatesShuffle(ids, random);

    assert.deepEqual([...mezclado].sort((x, y) => x - y), ids);
  });
});

const validarJornadasRoundRobin = (jornadas, teamIds) => {
  const n = teamIds.length;
  const esperadas = n % 2 === 0 ? n - 1 : n;
  assert.equal(jornadas.length, esperadas);

  const partidosPorJornadaEsperados = Math.floor(n / 2);
  const enfrentamientosTotales = new Set();

  for (const partidosJornada of jornadas) {
    assert.equal(partidosJornada.length, partidosPorJornadaEsperados);

    const equiposEnJornada = new Set();
    for (const [local, visitante] of partidosJornada) {
      assert.notEqual(local, visitante);
      assert.ok(teamIds.includes(local));
      assert.ok(teamIds.includes(visitante));
      assert.ok(!equiposEnJornada.has(local), `Equipo ${local} repetido en jornada`);
      assert.ok(!equiposEnJornada.has(visitante), `Equipo ${visitante} repetido en jornada`);
      equiposEnJornada.add(local);
      equiposEnJornada.add(visitante);

      const clave = [local, visitante].sort((a, b) => a - b).join('-');
      assert.ok(!enfrentamientosTotales.has(clave), `Enfrentamiento duplicado: ${clave}`);
      enfrentamientosTotales.add(clave);
    }
  }

  const totalEsperado = (n * (n - 1)) / 2;
  assert.equal(enfrentamientosTotales.size, totalEsperado);
};

describe('generarJornadasCircleMethod', () => {
  it('con 8 equipos genera 7 jornadas de 4 partidos sin repetir equipo en la misma jornada', () => {
    const teamIds = [1, 2, 3, 4, 5, 6, 7, 8];
    const jornadas = generarJornadasCircleMethod(teamIds);
    validarJornadasRoundRobin(jornadas, teamIds);
  });

  it('con 5 equipos genera 5 jornadas con 2 partidos (1 bye por jornada)', () => {
    const teamIds = [1, 2, 3, 4, 5];
    const jornadas = generarJornadasCircleMethod(teamIds);
    validarJornadasRoundRobin(jornadas, teamIds);
  });
});

describe('calcularTamanoBracket', () => {
  it('redondea hacia arriba a la potencia de 2 más cercana', () => {
    assert.equal(calcularTamanoBracket(4), 4);
    assert.equal(calcularTamanoBracket(5), 8);
    assert.equal(calcularTamanoBracket(6), 8);
    assert.equal(calcularTamanoBracket(9), 16);
  });
});

describe('generarRoundRobin', () => {
  let deps;

  beforeEach(() => {
    deps = crearDepsMock();
  });

  it('con 4 equipos ACEPTADA genera 6 partidos en 3 jornadas con campo jornada', async () => {
    deps.TorneoInscripcion.findAll = async () => ([
      { team_id: 101 },
      { team_id: 102 },
      { team_id: 103 },
      { team_id: 104 }
    ]);

    const resultado = await generarRoundRobin(FASE_ID, null, deps);

    assert.ok(!resultado.error);
    assert.equal(resultado.partidos.length, 6);
    assert.equal(deps._partidosCreados.length, 6);
    assert.equal(deps._participantesCreados.length, 12);

    const jornadas = deps._partidosCreados.map(({ payload }) => payload.jornada);
    assert.deepEqual([...new Set(jornadas)].sort(), [1, 2, 3]);
    assert.equal(jornadas.filter((j) => j === 1).length, 2);
    assert.equal(jornadas.filter((j) => j === 2).length, 2);
    assert.equal(jornadas.filter((j) => j === 3).length, 2);

    assert.ok(resultado.sorteo);
    assert.equal(resultado.sorteo.tipo_formato, 'TODOS_CONTRA_TODOS');
    assert.equal(resultado.sorteo.team_ids_sorteo.length, 4);
    assert.ok(resultado.sorteo.semilla_hex);
    assert.equal(deps._ordenSorteoGuardado.sorteos.length, 1);
  });

  it('con 8 equipos genera 28 partidos en 7 jornadas', async () => {
    deps.TorneoInscripcion.findAll = async () =>
      Array.from({ length: 8 }, (_, i) => ({ team_id: 201 + i }));

    const resultado = await generarRoundRobin(FASE_ID, null, deps);

    assert.ok(!resultado.error);
    assert.equal(resultado.partidos.length, 28);
    const jornadas = deps._partidosCreados.map(({ payload }) => payload.jornada);
    assert.deepEqual([...new Set(jornadas)].sort(), [1, 2, 3, 4, 5, 6, 7]);
    for (let j = 1; j <= 7; j += 1) {
      assert.equal(jornadas.filter((n) => n === j).length, 4);
    }
  });

  it('con 1 equipo devuelve error y no crea partidos ni participantes', async () => {
    deps.TorneoInscripcion.findAll = async () => ([{ team_id: 101 }]);

    const resultado = await generarRoundRobin(FASE_ID, null, deps);

    assert.equal(resultado.error, 'Se necesitan al menos 2 equipos para generar fixture');
    assert.equal(deps._partidosCreados.length, 0);
    assert.equal(deps._participantesCreados.length, 0);
  });

  it('con 0 equipos devuelve error y no crea partidos ni participantes', async () => {
    deps.TorneoInscripcion.findAll = async () => ([]);

    const resultado = await generarRoundRobin(FASE_ID, null, deps);

    assert.equal(resultado.error, 'Se necesitan al menos 2 equipos para generar fixture');
    assert.equal(deps._partidosCreados.length, 0);
    assert.equal(deps._participantesCreados.length, 0);
  });

  it('si ya existen partidos para la fase devuelve error de duplicado', async () => {
    deps.Partidos.count = async () => 3;
    deps.TorneoInscripcion.findAll = async () => ([
      { team_id: 101 },
      { team_id: 102 },
      { team_id: 103 },
      { team_id: 104 }
    ]);

    const resultado = await generarRoundRobin(FASE_ID, null, deps);

    assert.equal(resultado.error, 'Ya existe fixture generado para esta fase');
    assert.equal(deps._partidosCreados.length, 0);
    assert.equal(deps._participantesCreados.length, 0);
  });

  it('con grupoDivisionId filtra solo equipos del grupo (1 partido para 2 equipos del grupo A)', async () => {
    const GRUPO_A_ID = 20;
    const GRUPO_B_ID = 21;

    deps.TorneoInscripcion.findAll = async () => ([
      { team_id: 101 },
      { team_id: 102 },
      { team_id: 103 },
      { team_id: 104 }
    ]);
    deps.GrupoEquipos = {
      findAll: async ({ where }) => {
        if (where.grupo_division_id === GRUPO_A_ID) {
          return [{ team_id: 101 }, { team_id: 102 }];
        }
        if (where.grupo_division_id === GRUPO_B_ID) {
          return [{ team_id: 103 }, { team_id: 104 }];
        }
        return [];
      }
    };

    const resultado = await generarRoundRobin(FASE_ID, GRUPO_A_ID, deps);

    assert.ok(!resultado.error);
    assert.equal(resultado.partidos.length, 1);
    assert.equal(deps._partidosCreados.length, 1);
    assert.equal(deps._participantesCreados.length, 2);

    const participantes = deps._participantesCreados.map((p) => p.payload.team_id).sort();
    assert.deepEqual(participantes, [101, 102]);
    assert.equal(deps._partidosCreados[0].payload.grupo_division_id, GRUPO_A_ID);
  });

  it('permite generar otro grupo en la misma fase si el grupo actual no tiene fixture', async () => {
    const GRUPO_A_ID = 20;
    const GRUPO_B_ID = 21;

    deps.TorneoInscripcion.findAll = async () => ([
      { team_id: 101 },
      { team_id: 102 },
      { team_id: 103 },
      { team_id: 104 }
    ]);
    deps.GrupoEquipos = {
      findAll: async ({ where }) => {
        if (where.grupo_division_id === GRUPO_A_ID) {
          return [{ team_id: 101 }, { team_id: 102 }];
        }
        if (where.grupo_division_id === GRUPO_B_ID) {
          return [{ team_id: 103 }, { team_id: 104 }];
        }
        return [];
      }
    };
    deps.Partidos.count = async ({ where }) => (
      where.grupo_division_id === GRUPO_A_ID ? 1 : 0
    );

    const resultado = await generarRoundRobin(FASE_ID, GRUPO_B_ID, deps);

    assert.ok(!resultado.error);
    assert.equal(resultado.partidos.length, 1);
    assert.equal(deps._partidosCreados.length, 1);
    assert.equal(deps._partidosCreados[0].payload.grupo_division_id, GRUPO_B_ID);
  });

  it('si ya existen partidos para el grupo devuelve error de duplicado por grupo', async () => {
    const GRUPO_A_ID = 20;

    deps.Partidos.count = async ({ where }) => (
      where.grupo_division_id === GRUPO_A_ID ? 1 : 0
    );
    deps.GrupoEquipos = {
      findAll: async () => ([{ team_id: 101 }, { team_id: 102 }])
    };

    const resultado = await generarRoundRobin(FASE_ID, GRUPO_A_ID, deps);

    assert.equal(resultado.error, 'Ya existe fixture generado para este grupo');
    assert.equal(deps._partidosCreados.length, 0);
  });
});

describe('generarEliminacionDirecta', () => {
  let deps;

  beforeEach(() => {
    deps = crearDepsMock();
  });

  it('con 4 equipos genera 2 partidos de ronda 1, 1 final vacía y 2 progresiones R1→R2', async () => {
    deps.TorneoInscripcion.findAll = async () => ([
      { team_id: 101 },
      { team_id: 102 },
      { team_id: 103 },
      { team_id: 104 }
    ]);
    deps.asignarSlotsEnBracket = () => [101, 102, 103, 104];

    const resultado = await generarEliminacionDirecta(FASE_ID, deps);

    assert.ok(!resultado.error);
    assert.equal(resultado.tamanoBracket, 4);
    assert.equal(resultado.byes, 0);
    assert.equal(resultado.partidos.length, 3);

    const partidosR1 = deps._partidosCreados.slice(0, 2);
    assert.equal(partidosR1.length, 2);

    const r1ConDosParticipantes = deps._partidosCreados.filter(({ partido }) =>
      deps._participantesCreados.filter((p) => p.payload.partido_id === partido.id).length === 2
    );
    assert.equal(r1ConDosParticipantes.length, 2);

    const finalVacia = deps._partidosCreados.find(({ partido }) =>
      deps._participantesCreados.every((p) => p.payload.partido_id !== partido.id)
    );
    assert.ok(finalVacia);

    assert.equal(deps._progresionesCreadas.length, 2);
    for (const { payload } of deps._progresionesCreadas) {
      assert.equal(payload.condicion_avance, 'GANADOR');
      assert.ok(['LOCAL', 'VISITANTE'].includes(payload.posicion_destino));
      assert.equal(payload.torneo_id, TORNEO_ID);
    }
  });

  it('con 6 equipos completa bracket de 8 con 2 byes pre-asignados en ronda 2', async () => {
    deps.TorneoInscripcion.findAll = async () => ([
      { team_id: 101 },
      { team_id: 102 },
      { team_id: 103 },
      { team_id: 104 },
      { team_id: 105 },
      { team_id: 106 }
    ]);
    deps.asignarSlotsEnBracket = () => [101, null, 102, 103, null, 104, 105, 106];

    const resultado = await generarEliminacionDirecta(FASE_ID, deps);

    assert.ok(!resultado.error);
    assert.equal(resultado.tamanoBracket, 8);
    assert.equal(resultado.byes, 2);
    assert.equal(resultado.partidos.length, 5);

    const partidosConDosParticipantes = deps._partidosCreados.filter(({ partido }) =>
      deps._participantesCreados.filter((p) => p.payload.partido_id === partido.id).length === 2
    );
    assert.equal(partidosConDosParticipantes.length, 2);

    const partidosConUnParticipante = deps._partidosCreados.filter(({ partido }) =>
      deps._participantesCreados.filter((p) => p.payload.partido_id === partido.id).length === 1
    );
    assert.equal(partidosConUnParticipante.length, 2);

    const equiposConBye = [101, 104];
    for (const teamId of equiposConBye) {
      const participante = deps._participantesCreados.find((p) => p.payload.team_id === teamId);
      assert.ok(participante);
      assert.equal(participante.payload.es_local, true);
    }

    assert.equal(deps._progresionesCreadas.length, 4);
  });

  it('con 1 equipo devuelve error y no crea nada', async () => {
    deps.TorneoInscripcion.findAll = async () => ([{ team_id: 101 }]);

    const resultado = await generarEliminacionDirecta(FASE_ID, deps);

    assert.equal(resultado.error, 'Se necesitan al menos 2 equipos para generar fixture');
    assert.equal(deps._partidosCreados.length, 0);
    assert.equal(deps._participantesCreados.length, 0);
    assert.equal(deps._progresionesCreadas.length, 0);
  });

  it('si ya existen partidos para la fase devuelve error de duplicado', async () => {
    deps.Partidos.count = async () => 2;
    deps.TorneoInscripcion.findAll = async () => ([
      { team_id: 101 },
      { team_id: 102 },
      { team_id: 103 },
      { team_id: 104 }
    ]);

    const resultado = await generarEliminacionDirecta(FASE_ID, deps);

    assert.equal(resultado.error, 'Ya existe fixture generado para esta fase');
    assert.equal(deps._partidosCreados.length, 0);
    assert.equal(deps._participantesCreados.length, 0);
    assert.equal(deps._progresionesCreadas.length, 0);
  });
});
