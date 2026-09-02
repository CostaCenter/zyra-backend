import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirEmparejamientosCruzados,
  construirSlotsEliminatoriasDesdeGrupos,
  repartirEquiposEnGrupos,
  distribuirEquiposAleatorio,
} from '../gruposEliminatoriasService.js';
import { generarJornadasCircleMethod } from '../generadorFixture.js';
import { validarConfigGruposEliminatorias } from '../torneoConfigService.js';

describe('Grupos + Eliminatorias — 2 grupos de 4 (potencia de 2)', () => {
  it('distribuye 8 equipos en 2 grupos de 4', () => {
    const equipos = [1, 2, 3, 4, 5, 6, 7, 8];
    const grupos = repartirEquiposEnGrupos(equipos, 2);
    assert.equal(grupos.length, 2);
    assert.equal(grupos[0].length, 4);
    assert.equal(grupos[1].length, 4);
  });

  it('genera round-robin de 6 partidos por grupo', () => {
    const jornadasA = generarJornadasCircleMethod([1, 2, 3, 4]);
    const jornadasB = generarJornadasCircleMethod([5, 6, 7, 8]);
    const partidosA = jornadasA.flat().length;
    const partidosB = jornadasB.flat().length;
    assert.equal(partidosA, 6);
    assert.equal(partidosB, 6);
  });

  it('cruza 1° vs 2° entre grupos para 4 clasificados (bracket de 4)', () => {
    const grupos = [
      {
        grupoId: 1,
        nombre: 'Grupo A',
        clasificados: [
          { teamId: 101, posicion: 1 },
          { teamId: 102, posicion: 2 },
        ],
      },
      {
        grupoId: 2,
        nombre: 'Grupo B',
        clasificados: [
          { teamId: 201, posicion: 1 },
          { teamId: 202, posicion: 2 },
        ],
      },
    ];

    const emparejamientos = construirEmparejamientosCruzados(grupos, 2);
    const normalizarPar = (par) => [...par].sort((a, b) => a - b).join('-');
    assert.deepEqual(
      emparejamientos.map(normalizarPar).sort(),
      ['101-202', '102-201']
    );

    const { slots, tamanoBracket, byes, modoCruce } = construirSlotsEliminatoriasDesdeGrupos(
      grupos,
      2
    );

    assert.equal(tamanoBracket, 4);
    assert.equal(byes, 0);
    assert.equal(modoCruce, true);
    const paresSlots = [
      [slots[0], slots[1]],
      [slots[2], slots[3]],
    ].map((par) => [...par].sort((a, b) => a - b).join('-')).sort();
    assert.deepEqual(paresSlots, ['101-202', '102-201']);
  });

  it('validación de config no advierte bye cuando 2x2=4', () => {
    const validacion = validarConfigGruposEliminatorias({
      numero_grupos: 2,
      clasificados_por_grupo: 2,
      metodo_distribucion: 'ALEATORIO',
    });
    assert.equal(validacion.ok, true);
    assert.equal(validacion.advertenciaBye, null);
    assert.equal(validacion.totalClasificados, 4);
  });
});

describe('Grupos + Eliminatorias — bye (3 grupos x 1 clasificado)', () => {
  it('advierte que se necesitarán byes con 3 clasificados', () => {
    const validacion = validarConfigGruposEliminatorias({
      numero_grupos: 3,
      clasificados_por_grupo: 1,
      metodo_distribucion: 'ALEATORIO',
    });
    assert.equal(validacion.ok, true);
    assert.ok(validacion.advertenciaBye);
    assert.equal(validacion.totalClasificados, 3);
    assert.equal(validacion.tamanoBracket, 4);
  });

  it('asigna 1 bye al mejor clasificado global', () => {
    const grupos = [
      {
        grupoId: 1,
        nombre: 'Grupo A',
        clasificados: [{ teamId: 10, posicion: 1, puntos: 6, diferencia_sets: 4 }],
      },
      {
        grupoId: 2,
        nombre: 'Grupo B',
        clasificados: [{ teamId: 20, posicion: 1, puntos: 4, diferencia_sets: 2 }],
      },
      {
        grupoId: 3,
        nombre: 'Grupo C',
        clasificados: [{ teamId: 30, posicion: 1, puntos: 4, diferencia_sets: 1 }],
      },
    ];

    const { slots, byes, modoCruce, tamanoBracket } = construirSlotsEliminatoriasDesdeGrupos(
      grupos,
      1
    );

    assert.equal(tamanoBracket, 4);
    assert.equal(byes, 1);
    assert.equal(modoCruce, false);
    assert.equal(slots.filter(Boolean).length, 3);
    assert.equal(slots[1], 10, 'El mejor clasificado global ocupa slot con bye implícito');
    assert.ok(slots.includes(20));
    assert.ok(slots.includes(30));
  });

  it('distribución aleatoria reparte 9 equipos en 3 grupos de 3', () => {
    const grupos = distribuirEquiposAleatorio(
      Array.from({ length: 9 }, (_, i) => i + 1),
      3,
      () => 0.5
    );
    assert.equal(grupos.length, 3);
    assert.deepEqual(grupos.map((g) => g.length), [3, 3, 3]);
  });
});
