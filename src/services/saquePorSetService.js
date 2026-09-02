/** Reglas FIVB: set 1 manual, sets 2–4 alternados, set decisivo manual. */

export const alternarEquipoSaca = (equipo) => {
  if (equipo === 'local') return 'visitante';
  if (equipo === 'visitante') return 'local';
  return null;
};

export const numeroSetEnJuego = (parcialesSets = []) => (parcialesSets?.length ?? 0) + 1;

export const esSetDecisivoPorMarcador = (setsGanadosLocal, setsGanadosVisitante, reglas) => {
  const setsParaGanar = reglas?.sets_para_ganar ?? 3;
  return (
    setsGanadosLocal === setsParaGanar - 1
    && setsGanadosVisitante === setsParaGanar - 1
  );
};

/** Set 1 y set decisivo requieren elección del árbitro. */
export const requiereSorteoManualSaque = (
  setNumero,
  setsGanadosLocal,
  setsGanadosVisitante,
  reglas
) => {
  if (setNumero === 1) return true;
  return esSetDecisivoPorMarcador(setsGanadosLocal, setsGanadosVisitante, reglas);
};

export const obtenerEntradaHistorial = (historial, setNumero) =>
  (historial ?? []).find((e) => e.set_numero === setNumero) ?? null;

export const calcularSaqueAutomaticoSiguienteSet = (historial) => {
  if (!historial?.length) return null;
  const ultimo = historial[historial.length - 1];
  return alternarEquipoSaca(ultimo.equipo);
};

export const asegurarHistorialSet1 = (historial, equipoQueSacaInicial) => {
  const copia = [...(historial ?? [])];
  if (!equipoQueSacaInicial) return copia;
  if (!obtenerEntradaHistorial(copia, 1)) {
    copia.push({ set_numero: 1, equipo: equipoQueSacaInicial });
    copia.sort((a, b) => a.set_numero - b.set_numero);
  }
  return copia;
};

/**
 * Resuelve quién saca en el set actual y mantiene el historial saque_primero_por_set.
 */
export const resolverSaqueSetVolley = ({
  marcador,
  posicionesVolleyEquipoQueSaca,
  reglas,
  equipoQueSacaInicialPartido,
  historialPrevio = [],
  pendienteSaqueSetPrevio = null,
}) => {
  const parciales = marcador.metrica_estructura?.parciales_sets ?? [];
  const setActual = numeroSetEnJuego(parciales);
  const setsLocal = marcador.sets_ganados_local ?? 0;
  const setsVisitante = marcador.sets_ganados_visitante ?? 0;
  const puntosEnSet = (marcador.puntos_favor ?? 0) + (marcador.puntos_contra ?? 0);
  const partidoEnCurso = marcador.resultado_principal === 0;

  let historial = asegurarHistorialSet1(historialPrevio, equipoQueSacaInicialPartido);
  let pendiente_saque_set = pendienteSaqueSetPrevio ?? null;

  if (!partidoEnCurso) {
    return {
      equipo_que_saca: posicionesVolleyEquipoQueSaca,
      historial,
      pendiente_saque_set: null,
    };
  }

  const pendienteAlineacion = marcador.metrica_estructura?.pendiente_alineacion_set;
  if (pendienteAlineacion && puntosEnSet === 0 && setActual === pendienteAlineacion) {
    return {
      equipo_que_saca: posicionesVolleyEquipoQueSaca,
      historial,
      pendiente_saque_set: null,
    };
  }

  const entradaActual = obtenerEntradaHistorial(historial, setActual);
  const sorteoManual = requiereSorteoManualSaque(setActual, setsLocal, setsVisitante, reglas);

  if (entradaActual) {
    pendiente_saque_set = null;
    return {
      equipo_que_saca: puntosEnSet === 0 ? entradaActual.equipo : posicionesVolleyEquipoQueSaca,
      historial,
      pendiente_saque_set,
    };
  }

  if (puntosEnSet === 0 && setActual > 1) {
    if (sorteoManual) {
      return {
        equipo_que_saca: posicionesVolleyEquipoQueSaca,
        historial,
        pendiente_saque_set: setActual,
      };
    }

    const auto = calcularSaqueAutomaticoSiguienteSet(historial);
    if (auto) {
      historial = [...historial, { set_numero: setActual, equipo: auto }].sort(
        (a, b) => a.set_numero - b.set_numero
      );
      return {
        equipo_que_saca: auto,
        historial,
        pendiente_saque_set: null,
      };
    }
  }

  if (puntosEnSet === 0 && setActual === 1 && equipoQueSacaInicialPartido) {
    historial = asegurarHistorialSet1(historial, equipoQueSacaInicialPartido);
    const e1 = obtenerEntradaHistorial(historial, 1);
    return {
      equipo_que_saca: e1?.equipo ?? posicionesVolleyEquipoQueSaca,
      historial,
      pendiente_saque_set: null,
    };
  }

  return {
    equipo_que_saca: posicionesVolleyEquipoQueSaca,
    historial,
    pendiente_saque_set:
      sorteoManual && !entradaActual && puntosEnSet === 0 ? setActual : pendiente_saque_set,
  };
};

/** Aplica reglas de saque por set sobre el estado reducido antes de persistir. */
export const aplicarSaquePorSetAlEstado = (estadoReducido, marcadorRow, partidoRow) => {
  const res = resolverSaqueSetVolley({
    marcador: estadoReducido.marcador,
    posicionesVolleyEquipoQueSaca: estadoReducido.posicionesVolley.equipo_que_saca,
    reglas: marcadorRow.reglas_arbitraje_snapshot,
    equipoQueSacaInicialPartido: partidoRow?.equipo_que_saca_inicial,
    historialPrevio: marcadorRow.metrica_estructura?.saque_primero_por_set ?? [],
    pendienteSaqueSetPrevio: marcadorRow.metrica_estructura?.pendiente_saque_set ?? null,
  });

  estadoReducido.posicionesVolley.equipo_que_saca = res.equipo_que_saca;
  estadoReducido.marcador.metrica_estructura = {
    ...estadoReducido.marcador.metrica_estructura,
    saque_primero_por_set: res.historial,
    pendiente_saque_set: res.pendiente_saque_set,
  };

  return res;
};
