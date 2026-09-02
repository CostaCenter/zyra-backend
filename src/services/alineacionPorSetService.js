import { PartidoNominas, PartidoParticipantes } from '../db/db.js';
import { construirArrayAlineacionDesdeNominas } from './nominaAlineacionService.js';
import { resolverSaqueSetVolley } from './saquePorSetService.js';

/** @typedef {{ equipo_local: number[]|null, equipo_visitante: number[]|null }} AlineacionSet */

/**
 * Construye mapa { setNumero: { equipo_local, equipo_visitante } } desde filas VALIDADO.
 * @param {Array} nominasRows
 * @param {Map<number, boolean>} teamEsLocal - team_id -> es_local
 */
export const construirAlineacionesPorSetDesdeNominas = (nominasRows, teamEsLocal) => {
  /** @type {Record<number, { local: object[], visitante: object[] }>} */
  const porSet = {};

  for (const row of nominasRows) {
    if (row.estado_validacion !== 'VALIDADO') continue;
    const setNum = row.set_numero ?? 1;
    if (!porSet[setNum]) {
      porSet[setNum] = { local: [], visitante: [] };
    }
    const esLocal = teamEsLocal.get(row.team_id);
    if (esLocal === true) {
      porSet[setNum].local.push(row);
    } else if (esLocal === false) {
      porSet[setNum].visitante.push(row);
    }
  }

  /** @type {Record<number, AlineacionSet>} */
  const result = {};
  for (const [setNum, grupos] of Object.entries(porSet)) {
    result[Number(setNum)] = {
      equipo_local: construirArrayAlineacionDesdeNominas(grupos.local),
      equipo_visitante: construirArrayAlineacionDesdeNominas(grupos.visitante),
    };
  }
  return result;
};

export const alineacionSetCompleta = (alineacionesPorSet, setNumero) => {
  const alin = alineacionesPorSet?.[setNumero] ?? alineacionesPorSet?.[String(setNumero)];
  return (
    Array.isArray(alin?.equipo_local)
    && alin.equipo_local.length === 6
    && Array.isArray(alin?.equipo_visitante)
    && alin.equipo_visitante.length === 6
  );
};

export const numeroSetEnJuegoDesdeMarcador = (marcador) =>
  (marcador?.metrica_estructura?.parciales_sets?.length ?? 0) + 1;

/**
 * Si el set actual tiene 0 puntos y faltan alineaciones confirmadas, devuelve ese set.
 */
export const resolverPendienteAlineacionSet = (marcador, alineacionesPorSet) => {
  if (marcador?.resultado_principal !== 0) return null;

  const setActual = numeroSetEnJuegoDesdeMarcador(marcador);
  const puntosEnSet = (marcador.puntos_favor ?? 0) + (marcador.puntos_contra ?? 0);

  if (setActual <= 1 || puntosEnSet > 0) return null;
  if (alineacionSetCompleta(alineacionesPorSet, setActual)) return null;

  return setActual;
};

export const cargarAlineacionesPorSet = async (partidoId, transaction) => {
  const [nominas, participantes] = await Promise.all([
    PartidoNominas.findAll({
      where: { partido_id: partidoId, estado_validacion: 'VALIDADO' },
      attributes: ['team_id', 'user_id', 'rol_nomina', 'zona', 'set_numero', 'estado_validacion'],
      transaction,
    }),
    PartidoParticipantes.findAll({
      where: { partido_id: partidoId },
      attributes: ['team_id', 'es_local'],
      transaction,
    }),
  ]);

  const teamEsLocal = new Map(
    participantes.map((p) => [p.team_id, p.es_local === true])
  );

  return construirAlineacionesPorSetDesdeNominas(nominas, teamEsLocal);
};

export const posicionesInicialesSet1 = (alineacionesPorSet) => {
  const set1 = alineacionesPorSet?.[1] ?? alineacionesPorSet?.['1'];
  return {
    equipo_local: set1?.equipo_local ? [...set1.equipo_local] : null,
    equipo_visitante: set1?.equipo_visitante ? [...set1.equipo_visitante] : null,
  };
};

/**
 * Tras validar ambas alineaciones de un set, resuelve saque y limpia pendientes.
 */
export const aplicarAlineacionConfirmadaAlMarcador = ({
  marcadorRow,
  partidoRow,
  alineacionesPorSet,
  setNumero,
}) => {
  const alin = alineacionesPorSet[setNumero];
  if (!alin) return null;

  const metrica = { ...(marcadorRow.metrica_estructura ?? {}) };
  metrica.alineaciones_por_set = {
    ...(metrica.alineaciones_por_set ?? {}),
    [String(setNumero)]: alin,
  };
  metrica.pendiente_alineacion_set = null;

  const resSaque = resolverSaqueSetVolley({
    marcador: {
      ...marcadorRow.toJSON?.() ?? marcadorRow,
      metrica_estructura: {
        ...metrica,
        parciales_sets: metrica.parciales_sets ?? [],
      },
      puntos_favor: marcadorRow.puntos_favor ?? 0,
      puntos_contra: marcadorRow.puntos_contra ?? 0,
      sets_ganados_local: marcadorRow.sets_ganados_local ?? 0,
      sets_ganados_visitante: marcadorRow.sets_ganados_visitante ?? 0,
      resultado_principal: marcadorRow.resultado_principal ?? 0,
    },
    posicionesVolleyEquipoQueSaca: marcadorRow.equipo_que_saca,
    reglas: marcadorRow.reglas_arbitraje_snapshot,
    equipoQueSacaInicialPartido: partidoRow?.equipo_que_saca_inicial,
    historialPrevio: metrica.saque_primero_por_set ?? [],
    pendienteSaqueSetPrevio: null,
  });

  metrica.saque_primero_por_set = resSaque.historial;
  metrica.pendiente_saque_set = resSaque.pendiente_saque_set;

  return {
    posiciones_actuales: {
      equipo_local: alin.equipo_local ? [...alin.equipo_local] : null,
      equipo_visitante: alin.equipo_visitante ? [...alin.equipo_visitante] : null,
    },
    equipo_que_saca: resSaque.equipo_que_saca,
    metrica_estructura: metrica,
  };
};
