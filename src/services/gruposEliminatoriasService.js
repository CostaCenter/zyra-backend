import { fisherYatesShuffle } from '../utils/sorteoAleatorio.js';
import { esPotenciaDeDos } from './torneoConfigService.js';

const calcularTamanoBracket = (cantidadEquipos) => {
  let tamano = 1;
  while (tamano < cantidadEquipos) {
    tamano *= 2;
  }
  return tamano;
};

const LETRAS_GRUPO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const nombreGrupoPorIndice = (indice) => {
  if (indice < LETRAS_GRUPO.length) {
    return `Grupo ${LETRAS_GRUPO[indice]}`;
  }
  return `Grupo ${indice + 1}`;
};

/**
 * Distribuye equipos ya mezclados en grupos (round-robin sobre índices).
 */
export const repartirEquiposEnGrupos = (teamIdsMezclados, numeroGrupos) => {
  const grupos = Array.from({ length: numeroGrupos }, () => []);
  teamIdsMezclados.forEach((teamId, index) => {
    grupos[index % numeroGrupos].push(teamId);
  });
  return grupos;
};

export const distribuirEquiposAleatorio = (teamIds, numeroGrupos, random = Math.random) => {
  const mezclados = fisherYatesShuffle([...teamIds], random);
  return repartirEquiposEnGrupos(mezclados, numeroGrupos);
};

/**
 * Toma los primeros N de la tabla de posiciones por grupo.
 */
export const extraerClasificadosDePosiciones = (posiciones, clasificadosPorGrupo) =>
  posiciones.slice(0, clasificadosPorGrupo).map((fila, index) => ({
    teamId: fila.team_id,
    posicion: index + 1,
    puntos: fila.puntos ?? 0,
    diferencia_sets: fila.diferencia_sets ?? 0,
    partidos_jugados: fila.partidos_jugados ?? 0,
  }));

/**
 * Ranking global entre clasificados para asignar byes.
 * Mejor posición en grupo > más puntos > mejor diferencia de sets.
 */
export const rankearClasificadosGlobal = (gruposConClasificados) => {
  const todos = [];

  for (const grupo of gruposConClasificados) {
    for (const clasificado of grupo.clasificados) {
      todos.push({
        ...clasificado,
        grupoId: grupo.grupoId,
        grupoNombre: grupo.nombre,
      });
    }
  }

  todos.sort((a, b) => {
    if (a.posicion !== b.posicion) return a.posicion - b.posicion;
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.diferencia_sets !== a.diferencia_sets) return b.diferencia_sets - a.diferencia_sets;
    return String(a.grupoNombre).localeCompare(String(b.grupoNombre));
  });

  return todos;
};

/**
 * Emparejamientos cruzados entre grupos (patrón FIFA: 1° A vs 2° B, etc.).
 * Requiere número par de grupos y total clasificados potencia de 2.
 */
export const construirEmparejamientosCruzados = (gruposOrdenados, clasificadosPorGrupo) => {
  const G = gruposOrdenados.length;
  const C = clasificadosPorGrupo;
  const emparejamientos = [];
  const offset = Math.ceil(G / 2);

  for (let posicion = 0; posicion < C; posicion += 1) {
    for (let g = 0; g < offset; g += 1) {
      const gA = g;
      const gB = (g + offset) % G;
      if (gB <= gA && G > 2) continue;

      const teamA = gruposOrdenados[gA]?.clasificados[posicion];
      const teamB = gruposOrdenados[gB]?.clasificados[C - 1 - posicion];

      if (teamA?.teamId && teamB?.teamId) {
        emparejamientos.push([teamA.teamId, teamB.teamId]);
      }
    }
  }

  return emparejamientos;
};

/**
 * Construye slots del bracket de eliminatorias desde clasificados de grupos.
 * @returns {{ slots: (number|null)[], byes: number, emparejamientos: number[][] }}
 */
export const construirSlotsEliminatoriasDesdeGrupos = (
  gruposConClasificados,
  clasificadosPorGrupo
) => {
  const totalClasificados = gruposConClasificados.reduce(
    (acc, g) => acc + g.clasificados.length,
    0
  );
  const tamanoBracket = calcularTamanoBracket(Math.max(1, totalClasificados));
  const slots = Array(tamanoBracket).fill(null);

  const G = gruposConClasificados.length;
  const usarCruce = G % 2 === 0
    && G >= 2
    && esPotenciaDeDos(totalClasificados)
    && totalClasificados === G * clasificadosPorGrupo;

  let emparejamientos = [];

  if (usarCruce) {
    emparejamientos = construirEmparejamientosCruzados(
      gruposConClasificados,
      clasificadosPorGrupo
    );

    emparejamientos.forEach(([local, visitante], index) => {
      slots[index * 2] = local;
      slots[index * 2 + 1] = visitante;
    });
  } else {
    const rankeados = rankearClasificadosGlobal(gruposConClasificados);
    const numByes = tamanoBracket - rankeados.length;

    rankeados.forEach((equipo, index) => {
      slots[index + numByes] = equipo.teamId;
    });
  }

  const byes = slots.filter((s) => s === null).length
    + Math.floor(emparejamientos.length === 0
      ? tamanoBracket - totalClasificados
      : 0);

  return {
    slots,
    tamanoBracket,
    totalClasificados,
    byes: tamanoBracket - totalClasificados,
    emparejamientos,
    modoCruce: usarCruce,
  };
};

export default {
  nombreGrupoPorIndice,
  repartirEquiposEnGrupos,
  distribuirEquiposAleatorio,
  extraerClasificadosDePosiciones,
  rankearClasificadosGlobal,
  construirEmparejamientosCruzados,
  construirSlotsEliminatoriasDesdeGrupos,
};
