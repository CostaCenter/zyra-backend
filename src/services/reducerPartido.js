// ============================================================
// Paso 1 — Orden estricto y filtrado de eventos anulados
// ============================================================

function ordenarEventos(eventos) {
  return [...eventos].sort((a, b) => {
    if (a.dispositivo_id !== b.dispositivo_id) {
      return new Date(a.ocurrido_en_cliente) - new Date(b.ocurrido_en_cliente);
    }
    return a.secuencia_local - b.secuencia_local;
  });
}

function filtrarEventosValidos(eventosOrdenados) {
  const anulados = new Set();
  const idsDeAnulacion = new Set();

  for (const evento of eventosOrdenados) {
    if (evento.tipo_evento === 'ANULACION_EVENTO') {
      const targetId = evento.detalle_json?.evento_anulado_id;
      // Anti-doble-anulación: si el target ya fue anulado, o es en sí misma
      // una ANULACION_EVENTO, se ignora esta anulación.
      if (targetId && !anulados.has(targetId) && !idsDeAnulacion.has(targetId)) {
        anulados.add(targetId);
      }
      idsDeAnulacion.add(evento.id);
    }
  }

  return eventosOrdenados.filter(
    (e) => !anulados.has(e.id) && e.tipo_evento !== 'ANULACION_EVENTO'
  );
}

// ============================================================
// Paso 2 — Sub-reducers aislados por dominio
// (cada uno ignora eventos que no le interesan; testeables por separado)
// ============================================================

function reducirMarcador(eventosValidos, reglas) {
  return eventosValidos
    .filter((e) => e.tipo_evento === 'PUNTO')
    .reduce((estado, evento) => aplicarPunto(estado, evento, reglas), estadoMarcadorInicial());
}

function reducirRotacion(eventosValidos, formacionInicial) {
  return eventosValidos
    .filter((e) => e.tipo_evento === 'ROTACION' || e.tipo_evento === 'PUNTO')
    .reduce(
      (estado, evento) => aplicarRotacion(estado, evento),
      { formacion_actual: formacionInicial, jugador_al_saque: formacionInicial[0] ?? null }
    );
}

/** Rota posiciones en sentido horario FIVB: z2→z1, z1→z6, z6→z5, z5→z4, z4→z3, z3→z2 */
function rotarPosicionesEquipo(posiciones) {
  if (!Array.isArray(posiciones) || posiciones.length !== 6) {
    return posiciones;
  }
  return [
    posiciones[1],
    posiciones[2],
    posiciones[3],
    posiciones[4],
    posiciones[5],
    posiciones[0],
  ];
}

const equipoPuntoALlave = (equipoPunto) => {
  if (equipoPunto === 'LOCAL') return 'local';
  if (equipoPunto === 'VISITANTE') return 'visitante';
  return null;
};

function estadoPosicionesInicial(posicionesIniciales, equipoQueSacaInicial) {
  return {
    posiciones_actuales: {
      equipo_local: posicionesIniciales?.equipo_local
        ? [...posicionesIniciales.equipo_local]
        : null,
      equipo_visitante: posicionesIniciales?.equipo_visitante
        ? [...posicionesIniciales.equipo_visitante]
        : null
    },
    equipo_que_saca: equipoQueSacaInicial ?? null
  };
}

function clonarPosicionesSet(alineacionSet) {
  if (!alineacionSet) return null;
  return {
    equipo_local: alineacionSet.equipo_local ? [...alineacionSet.equipo_local] : null,
    equipo_visitante: alineacionSet.equipo_visitante
      ? [...alineacionSet.equipo_visitante]
      : null,
  };
}

function obtenerAlineacionSet(alineacionesPorSet, setNumero) {
  if (!alineacionesPorSet) return null;
  return alineacionesPorSet[setNumero] ?? alineacionesPorSet[String(setNumero)] ?? null;
}

function resolverSaqueInicioSet(historialSaque, setNumero, equipoQueSacaInicial) {
  const entrada = (historialSaque ?? []).find((e) => e.set_numero === setNumero);
  if (entrada?.equipo) return entrada.equipo;
  if (setNumero === 1) return equipoQueSacaInicial ?? null;
  return null;
}

/**
 * Reduce rotación vóley. Al cerrar un set, reinicia posiciones desde la alineación
 * confirmada del siguiente set (no arrastra rotación del set anterior).
 */
function reducirPosicionesVolley(
  eventosValidos,
  posicionesIniciales,
  equipoQueSacaInicial,
  opciones = {}
) {
  const {
    alineacionesPorSet = null,
    reglas = null,
    historialSaquePorSet = null,
  } = opciones;
  const puntos = eventosValidos.filter((e) => e.tipo_evento === 'PUNTO');

  let estado = estadoPosicionesInicial(posicionesIniciales, equipoQueSacaInicial);
  let marcadorEstado = estadoMarcadorInicial();

  for (const evento of puntos) {
    estado = aplicarRotacionVolleyPorPunto(estado, evento);

    if (reglas) {
      const parcialesAntes = obtenerParcialesSets(marcadorEstado.metrica_estructura).length;
      marcadorEstado = aplicarPunto(marcadorEstado, evento, reglas);
      const parcialesDespues = obtenerParcialesSets(marcadorEstado.metrica_estructura).length;

      if (
        parcialesDespues > parcialesAntes
        && marcadorEstado.resultado_principal === 0
      ) {
        const setSiguiente = parcialesDespues + 1;
        const alinSet = obtenerAlineacionSet(alineacionesPorSet, setSiguiente);
        const posicionesReset = clonarPosicionesSet(alinSet);
        const saqueSet = resolverSaqueInicioSet(
          historialSaquePorSet,
          setSiguiente,
          equipoQueSacaInicial
        );
        if (posicionesReset) {
          estado = {
            ...estado,
            posiciones_actuales: posicionesReset,
            ...(saqueSet ? { equipo_que_saca: saqueSet } : {}),
          };
        }
      }
    }
  }

  return estado;
}

function aplicarRotacionVolleyPorPunto(estado, evento) {
  const equipoPunto = evento.detalle_json?.equipo;
  const equipoLlave = equipoPuntoALlave(equipoPunto);
  if (!equipoLlave) {
    return estado;
  }

  const huboSideOut = estado.equipo_que_saca != null && equipoLlave !== estado.equipo_que_saca;
  const posiciones = { ...estado.posiciones_actuales };

  if (huboSideOut) {
    const campoEquipo = equipoLlave === 'local' ? 'equipo_local' : 'equipo_visitante';
    const actuales = posiciones[campoEquipo];
    if (Array.isArray(actuales) && actuales.length === 6) {
      posiciones[campoEquipo] = rotarPosicionesEquipo(actuales);
    }
  }

  return {
    posiciones_actuales: posiciones,
    equipo_que_saca: equipoLlave
  };
}

function reducirSanciones(eventosValidos) {
  return eventosValidos
    .filter((e) => e.tipo_evento === 'SANCION')
    .reduce((estado, evento) => aplicarSancion(estado, evento), { tarjetas: [] });
}

// ============================================================
// Reducer principal — función pura, sin efectos secundarios
// (no dispara notificaciones ni nada externo; eso vive en un
// proceso que INVOCA a este reducer y reacciona a los cambios)
// ============================================================

function reducirEstadoPartido(eventos, reglas, formacionInicial, snapshotPrevio, opcionesVolley = {}) {
  const eventosAProcesar = snapshotPrevio
    ? eventos.filter((e) => e.id !== snapshotPrevio.ultimo_evento_id_procesado)
    : eventos;

  const ordenados = ordenarEventos(eventosAProcesar);
  const validos = filtrarEventosValidos(ordenados);

  const posicionesIniciales = opcionesVolley.posicionesIniciales ?? {
    equipo_local: null,
    equipo_visitante: null
  };
  const equipoQueSacaInicial = opcionesVolley.equipoQueSacaInicial ?? null;
  const alineacionesPorSet = opcionesVolley.alineacionesPorSet ?? null;

  return {
    marcador: reducirMarcador(validos, reglas),
    rotacion: reducirRotacion(validos, formacionInicial),
    posicionesVolley: reducirPosicionesVolley(
      validos,
      posicionesIniciales,
      equipoQueSacaInicial,
      {
        alineacionesPorSet,
        reglas,
        historialSaquePorSet: opcionesVolley.historialSaquePorSet ?? null,
      }
    ),
    sanciones: reducirSanciones(validos),
    ultimo_evento_id_procesado:
      ordenados.at(-1)?.id ?? snapshotPrevio?.ultimo_evento_id_procesado ?? null,
  };
}

// Helpers de dominio — implementar según reglas de cada deporte.
// aplicarPunto: usa `reglas.puntos_por_set`, `reglas.ventaja_obligatoria`,
//   `reglas.sets_para_ganar` para decidir si un punto cierra el set.
function estadoMarcadorInicial() {
  return {
    resultado_principal: 0,
    sets_ganados_local: 0,
    sets_ganados_visitante: 0,
    puntos_favor: 0,
    puntos_contra: 0,
    metrica_estructura: {},
  };
}

function obtenerParcialesSets(metricaEstructura) {
  return metricaEstructura.parciales_sets
    ? [...metricaEstructura.parciales_sets]
    : [];
}

function resolverPuntosPorSet(reglas, setsGanadosLocal, setsGanadosVisitante) {
  const esSetDecisivo =
    setsGanadosLocal === reglas.sets_para_ganar - 1 &&
    setsGanadosVisitante === reglas.sets_para_ganar - 1;

  if (esSetDecisivo) {
    return reglas.puntos_set_decisivo ?? 15;
  }

  return reglas.puntos_por_set;
}

function equipoGanaSet(puntosLocal, puntosVisitante, reglas, contexto = {}) {
  const setsGanadosLocal = contexto.sets_ganados_local ?? 0;
  const setsGanadosVisitante = contexto.sets_ganados_visitante ?? 0;
  const puntosPorSet = resolverPuntosPorSet(reglas, setsGanadosLocal, setsGanadosVisitante);
  const { ventaja_obligatoria } = reglas;
  const diferencia = Math.abs(puntosLocal - puntosVisitante);

  if (
    puntosLocal >= puntosPorSet &&
    puntosLocal > puntosVisitante &&
    diferencia >= ventaja_obligatoria
  ) {
    return 'LOCAL';
  }

  if (
    puntosVisitante >= puntosPorSet &&
    puntosVisitante > puntosLocal &&
    diferencia >= ventaja_obligatoria
  ) {
    return 'VISITANTE';
  }

  return null;
}

function aplicarPunto(estado, evento, reglas) {
  // Partido ya terminado: no procesar más puntos.
  if (estado.resultado_principal !== 0) {
    return estado;
  }

  const equipo = evento.detalle_json?.equipo;
  if (equipo !== 'LOCAL' && equipo !== 'VISITANTE') {
    return estado;
  }

  const { sets_para_ganar } = reglas;

  // Convención de marcador del set en curso (alineada con score_local/score_visitante):
  // - puntos_favor   = puntos del LOCAL en el set actual
  // - puntos_contra  = puntos del VISITANTE en el set actual
  let puntosLocal = estado.puntos_favor;
  let puntosVisitante = estado.puntos_contra;
  let setsLocal = estado.sets_ganados_local;
  let setsVisitante = estado.sets_ganados_visitante;
  let resultadoPrincipal = estado.resultado_principal;
  const parciales = obtenerParcialesSets(estado.metrica_estructura);

  if (equipo === 'LOCAL') {
    puntosLocal += 1;
  } else {
    puntosVisitante += 1;
  }

  const ganadorSet = equipoGanaSet(puntosLocal, puntosVisitante, reglas, {
    sets_ganados_local: setsLocal,
    sets_ganados_visitante: setsVisitante
  });

  if (ganadorSet) {
    parciales.push([puntosLocal, puntosVisitante]);

    if (ganadorSet === 'LOCAL') {
      setsLocal += 1;
    } else {
      setsVisitante += 1;
    }

    puntosLocal = 0;
    puntosVisitante = 0;

    // resultado_principal: 1 = LOCAL ganó el partido, -1 = VISITANTE, 0 = en curso
    if (setsLocal >= sets_para_ganar) {
      resultadoPrincipal = 1;
    } else if (setsVisitante >= sets_para_ganar) {
      resultadoPrincipal = -1;
    }
  }

  return {
    resultado_principal: resultadoPrincipal,
    sets_ganados_local: setsLocal,
    sets_ganados_visitante: setsVisitante,
    puntos_favor: puntosLocal,
    puntos_contra: puntosVisitante,
    metrica_estructura: {
      ...estado.metrica_estructura,
      parciales_sets: parciales
    }
  };
}

function aplicarRotacion(estado, evento) {
  // La decisión de CUÁNDO rotar (p. ej. "el receptor gana el punto y rota en
  // sentido horario") vive en el backend/validador al insertar eventos. Este
  // reducer solo aplica eventos ROTACION explícitos que ya llegan en el log;
  // los PUNTO no modifican formacion_actual para mantener la función pura.
  if (evento.tipo_evento !== 'ROTACION') {
    return estado;
  }

  const nuevaFormacion = evento.detalle_json?.nueva_formacion;
  if (!Array.isArray(nuevaFormacion) || nuevaFormacion.length === 0) {
    return estado;
  }

  return {
    formacion_actual: [...nuevaFormacion],
    jugador_al_saque: nuevaFormacion[0] ?? null
  };
}

function aplicarSancion(estado, evento) {
  const tarjeta = evento.detalle_json?.tarjeta;

  if (tarjeta !== 'AMARILLA' && tarjeta !== 'ROJA') {
    return estado;
  }

  const nuevaEntrada = {
    jugador_id: evento.actor_principal_id,
    tipo: tarjeta,
    evento_id: evento.id
  };

  return {
    tarjetas: [...estado.tarjetas, nuevaEntrada]
  };
}

export {
  ordenarEventos,
  filtrarEventosValidos,
  reducirMarcador,
  reducirRotacion,
  reducirPosicionesVolley,
  reducirSanciones,
  reducirEstadoPartido,
  estadoMarcadorInicial,
  estadoPosicionesInicial,
  resolverPuntosPorSet,
  equipoGanaSet,
  aplicarPunto,
  aplicarRotacion,
  aplicarRotacionVolleyPorPunto,
  aplicarSancion,
  rotarPosicionesEquipo,
  equipoPuntoALlave
};
