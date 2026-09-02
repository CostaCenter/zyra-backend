import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  programarPartidosGreedy,
  generarSlotsDisponibles,
} from '../programacionPartidosService.js';

const MS_MINUTO = 60 * 1000;

describe('Programación greedy de partidos', () => {
  const configBase = {
    fechaInicio: '2026-09-01T08:00:00',
    tipoDuracion: 'RELAMPAGO',
    horaInicioDiaria: '08:00:00',
    horaFinDiaria: '20:00:00',
    duracionPartidoMinutos: 60,
    numeroCanchas: 2,
    descansoMinimoMinutos: 30,
  };

  it('genera slots para 2 canchas en ventana de 12 horas', () => {
    const { slots, error } = generarSlotsDisponibles(configBase);
    assert.ok(!error);
    assert.ok(slots.length >= 24, 'Al menos 12 horas x 2 canchas');
    const canchas = new Set(slots.map((s) => s.cancha_id));
    assert.deepEqual([...canchas].sort(), [1, 2]);
  });

  it('respeta descanso mínimo: ningún equipo juega dos partidos seguidos sin 30 min', () => {
    const partidos = [
      { id: 1, jornada: 1, equipos: [10, 20] },
      { id: 2, jornada: 1, equipos: [30, 40] },
      { id: 3, jornada: 1, equipos: [10, 30] },
      { id: 4, jornada: 2, equipos: [20, 40] },
      { id: 5, jornada: 2, equipos: [10, 40] },
      { id: 6, jornada: 2, equipos: [20, 30] },
    ];

    const resultado = programarPartidosGreedy(partidos, configBase);
    assert.ok(!resultado.error, resultado.error);
    assert.equal(resultado.asignaciones.length, 6);

    const porEquipo = new Map();
    for (const asignacion of resultado.asignaciones) {
      const partido = partidos.find((p) => p.id === asignacion.partidoId);
      for (const teamId of partido.equipos) {
        if (!porEquipo.has(teamId)) porEquipo.set(teamId, []);
        porEquipo.get(teamId).push(asignacion.datetime.getTime());
      }
    }

    for (const [teamId, tiempos] of porEquipo) {
      const ordenados = [...tiempos].sort((a, b) => a - b);
      for (let i = 1; i < ordenados.length; i += 1) {
        const diffMin = (ordenados[i] - ordenados[i - 1]) / MS_MINUTO;
        assert.ok(
          diffMin >= 90,
          `Equipo ${teamId}: intervalo ${diffMin} min (60 partido + 30 descanso mínimo)`
        );
      }
    }
  });

  it('no programa más partidos simultáneos que canchas disponibles', () => {
    const partidos = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      jornada: 1,
      equipos: [100 + i, 200 + i],
    }));

    const resultado = programarPartidosGreedy(partidos, configBase);
    assert.ok(!resultado.error);

    const porInstante = new Map();
    for (const { datetime, cancha_id } of resultado.asignaciones) {
      const key = datetime.getTime();
      if (!porInstante.has(key)) porInstante.set(key, new Set());
      porInstante.get(key).add(cancha_id);
    }

    for (const [instante, canchas] of porInstante) {
      assert.ok(
        canchas.size <= 2,
        `A las ${new Date(Number(instante)).toISOString()} hay ${canchas.size} canchas ocupadas`
      );
    }
  });

  it('asigna partidos dentro de la ventana horaria diaria', () => {
    const partidos = [
      { id: 1, jornada: 1, equipos: [1, 2] },
      { id: 2, jornada: 1, equipos: [3, 4] },
    ];

    const resultado = programarPartidosGreedy(partidos, configBase);
    assert.ok(!resultado.error);

    for (const { datetime } of resultado.asignaciones) {
      const hora = datetime.getHours();
      const minutos = datetime.getMinutes();
      const totalMin = hora * 60 + minutos;
      assert.ok(totalMin >= 8 * 60, 'Antes de hora_inicio_diaria');
      assert.ok(totalMin + 60 <= 20 * 60, 'Termina después de hora_fin_diaria');
    }
  });
});
