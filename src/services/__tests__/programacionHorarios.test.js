/**
 * Tests de programación de horarios — Momento 1 (inicial) y Momento 2 (recálculo en vivo).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generarJornadasCircleMethod } from '../generadorFixture.js';
import {
  programarPartidosGreedy,
  reprogramarPartidosPendientes,
  calcularFinEstimadoPartido,
  calcularDesfaseFinalizacionMinutos,
} from '../programacionPartidosService.js';
import {
  obtenerConfigLogistica,
  MARGEN_SEGURIDAD_PARTIDO_MINUTOS,
  UMBRAL_DESFASE_RECALCULO_MINUTOS,
} from '../torneoConfigService.js';

const MS_MINUTO = 60 * 1000;

const construirPartidosDesdeJornadas = (jornadas) => {
  let id = 1;
  const partidos = [];
  jornadas.forEach((jornada, indice) => {
    jornada.forEach(([local, visitante]) => {
      partidos.push({
        id: id++,
        jornada: indice + 1,
        equipos: [local, visitante],
        state: 'PROGRAMADO',
      });
    });
  });
  return partidos;
};

const verificarDescansoEquipos = (asignaciones, partidos, duracionMin, descansoMin) => {
  const mapaPartido = new Map(partidos.map((p) => [p.id, p]));
  const porEquipo = new Map();

  for (const asignacion of asignaciones) {
    const partido = mapaPartido.get(asignacion.partidoId);
    const inicioMs = asignacion.datetime.getTime();
    const finMs = asignacion.finRealMs
      ?? (inicioMs + (asignacion.duracion_programada_minutos ?? duracionMin) * MS_MINUTO);

    for (const teamId of partido.equipos) {
      if (!porEquipo.has(teamId)) porEquipo.set(teamId, []);
      porEquipo.get(teamId).push({ inicioMs, finMs });
    }
  }

  for (const [teamId, intervalos] of porEquipo) {
    const ordenados = [...intervalos].sort((a, b) => a.inicioMs - b.inicioMs);
    for (let i = 1; i < ordenados.length; i += 1) {
      const gapDescanso = (ordenados[i].inicioMs - ordenados[i - 1].finMs) / MS_MINUTO;
      assert.ok(
        gapDescanso >= descansoMin - 0.01,
        `Equipo ${teamId}: descanso ${gapDescanso.toFixed(1)} min < mínimo ${descansoMin}`
      );
    }
  }
};

const verificarCanchasSimultaneas = (asignaciones, numeroCanchas, duracionMin) => {
  const eventos = [];
  for (const { datetime, cancha_id } of asignaciones) {
    eventos.push({
      t: datetime.getTime(),
      delta: 1,
      cancha: cancha_id,
    });
    eventos.push({
      t: datetime.getTime() + duracionMin * MS_MINUTO,
      delta: -1,
      cancha: cancha_id,
    });
  }
  eventos.sort((a, b) => a.t - b.t || a.delta - b.delta);

  const activasPorCancha = new Map();
  for (const ev of eventos) {
    const prev = activasPorCancha.get(ev.cancha) ?? 0;
    const next = prev + ev.delta;
    activasPorCancha.set(ev.cancha, next);
    if (next > 1) {
      assert.fail(`Solapamiento en cancha ${ev.cancha}`);
    }
  }

  const porInstante = new Map();
  for (const { datetime, cancha_id } of asignaciones) {
    const key = datetime.getTime();
    if (!porInstante.has(key)) porInstante.set(key, new Set());
    porInstante.get(key).add(cancha_id);
  }
  for (const [, canchas] of porInstante) {
    assert.ok(canchas.size <= numeroCanchas);
  }
};

describe('MOMENTO 1 — Programación inicial fase de grupos', () => {
  const torneoMock = {
    reglas_arbitraje_json: { sets_para_ganar: 3 },
    duracion_promedio_set_minutos: 30,
    descanso_entre_sets_minutos: 5,
    numero_canchas: 4,
    tipo_duracion: 'MULTIPLE_DIAS',
    fecha_hora_inicio: '2026-09-01T08:00:00',
    fecha_fin: '2026-09-30',
    hora_inicio_diaria: '08:00:00',
    hora_fin_diaria: '22:00:00',
  };

  const config = obtenerConfigLogistica(torneoMock);
  const duracionProgramada = config.duracion_partido_programacion_minutos;
  const descansoMinimo = config.descanso_minimo_entre_partidos_minutos;

  it('usa duración con margen y descanso entre partidos independiente (15–20 min)', () => {
    assert.equal(duracionProgramada, 170 + MARGEN_SEGURIDAD_PARTIDO_MINUTOS);
    assert.equal(descansoMinimo, 15);
    assert.notEqual(descansoMinimo, duracionProgramada);
  });

  it('16 equipos, 4 canchas: descanso mínimo respetado en todos los equipos', () => {
    const teamIds = Array.from({ length: 16 }, (_, i) => i + 1);
    const jornadas = generarJornadasCircleMethod(teamIds);
    const partidos = construirPartidosDesdeJornadas(jornadas);

    assert.equal(partidos.length, 120);

    const resultado = programarPartidosGreedy(partidos, {
      fechaInicio: torneoMock.fecha_hora_inicio,
      fechaFin: torneoMock.fecha_fin,
      tipoDuracion: torneoMock.tipo_duracion,
      horaInicioDiaria: torneoMock.hora_inicio_diaria,
      horaFinDiaria: torneoMock.hora_fin_diaria,
      duracionPartidoMinutos: duracionProgramada,
      numeroCanchas: torneoMock.numero_canchas,
      descansoMinimoMinutos: descansoMinimo,
    });

    assert.ok(!resultado.error, resultado.error);
    assert.equal(resultado.asignaciones.length, 120);

    verificarDescansoEquipos(
      resultado.asignaciones,
      partidos,
      duracionProgramada,
      descansoMinimo
    );
    verificarCanchasSimultaneas(
      resultado.asignaciones,
      torneoMock.numero_canchas,
      duracionProgramada
    );

    for (const asignacion of resultado.asignaciones) {
      assert.equal(asignacion.duracion_programada_minutos, duracionProgramada);
    }
  });
});

describe('MOMENTO 2 — Recalculación en vivo tras desfase', () => {
  const duracionProgramada = 117;
  const descansoMinimo = 15;
  const config = {
    fechaInicio: '2026-09-01T08:00:00',
    tipoDuracion: 'RELAMPAGO',
    horaInicioDiaria: '08:00:00',
    horaFinDiaria: '22:00:00',
    duracionPartidoMinutos: duracionProgramada,
    numeroCanchas: 2,
    descansoMinimoMinutos: descansoMinimo,
  };

  it('umbral de desfase definido en 15 minutos', () => {
    assert.equal(UMBRAL_DESFASE_RECALCULO_MINUTOS, 15);
  });

  it('partido +30 min tarde reprograma pendientes del equipo y cancha afectada', () => {
    const inicioP1 = new Date('2026-09-01T08:00:00');
    const finEstimadoP1 = new Date(inicioP1.getTime() + duracionProgramada * MS_MINUTO);
    const finalizadoRealP1 = new Date(finEstimadoP1.getTime() + 30 * MS_MINUTO);

    const partido1 = {
      id: 1,
      jornada: 1,
      state: 'FINALIZADO',
      datetime: inicioP1,
      cancha_id: 1,
      duracion_programada_minutos: duracionProgramada,
      equipos: [10, 20],
      finRealMs: finalizadoRealP1.getTime(),
    };

    const partido2 = {
      id: 2,
      jornada: 1,
      state: 'PROGRAMADO',
      datetime: new Date('2026-09-01T10:00:00'),
      cancha_id: 1,
      duracion_programada_minutos: duracionProgramada,
      equipos: [30, 40],
    };

    const partido3 = {
      id: 3,
      jornada: 2,
      state: 'PROGRAMADO',
      datetime: new Date('2026-09-01T11:00:00'),
      cancha_id: 2,
      duracion_programada_minutos: duracionProgramada,
      equipos: [10, 30],
    };

    const partido4 = {
      id: 4,
      jornada: 2,
      state: 'PROGRAMADO',
      datetime: new Date('2026-09-01T11:00:00'),
      cancha_id: 1,
      duracion_programada_minutos: duracionProgramada,
      equipos: [20, 40],
    };

    const desfase = calcularDesfaseFinalizacionMinutos(partido1, finalizadoRealP1);
    assert.ok(Math.abs(desfase) >= UMBRAL_DESFASE_RECALCULO_MINUTOS);

    const resultado = reprogramarPartidosPendientes(
      [partido2, partido3, partido4],
      [partido1],
      config,
      finalizadoRealP1
    );

    assert.ok(!resultado.error, resultado.error);
    assert.equal(resultado.asignaciones.length, 3);

    const asigP2 = resultado.asignaciones.find((a) => a.partidoId === 2);
    const asigP3 = resultado.asignaciones.find((a) => a.partidoId === 3);
    const asigP4 = resultado.asignaciones.find((a) => a.partidoId === 4);

    assert.ok(asigP2.datetime.getTime() >= finalizadoRealP1.getTime());
    assert.ok(asigP3.datetime.getTime() >= finalizadoRealP1.getTime());

    const finEstimado = calcularFinEstimadoPartido(partido1);
    assert.ok(asigP4.datetime.getTime() >= finEstimado.getTime());

    verificarDescansoEquipos(
      [
        {
          partidoId: 1,
          datetime: partido1.datetime,
          finRealMs: finalizadoRealP1.getTime(),
        },
        ...resultado.asignaciones,
      ],
      [partido1, partido2, partido3, partido4],
      duracionProgramada,
      descansoMinimo
    );

    const mapaAsig = new Map(resultado.asignaciones.map((a) => [a.partidoId, a]));
    assert.notEqual(
      mapaAsig.get(2).datetime.getTime(),
      partido2.datetime.getTime(),
      'Partido en misma cancha debe reprogramarse'
    );
  });
});
