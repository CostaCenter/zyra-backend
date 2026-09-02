import {
  ordenarEventos,
  filtrarEventosValidos,
  aplicarRotacionVolleyPorPunto,
  equipoPuntoALlave,
  aplicarPunto,
  estadoMarcadorInicial,
} from './reducerPartido.js';

const REGLAS_VOLEY_DEFAULT = {
  puntos_por_set: 25,
  ventaja_obligatoria: 2,
  sets_para_ganar: 3,
};

const obtenerAlineacionSet = (alineacionesPorSet, setNumero) => {
  if (!alineacionesPorSet) return null;
  return alineacionesPorSet[setNumero] ?? alineacionesPorSet[String(setNumero)] ?? null;
};

const resolverSaqueInicioSet = (historialSaque, setNumero, equipoQueSacaInicial) => {
  const entrada = (historialSaque ?? []).find((e) => e.set_numero === setNumero);
  if (entrada?.equipo) return entrada.equipo;
  if (setNumero === 1) return equipoQueSacaInicial ?? null;
  return null;
};

const ZONAS = [1, 2, 3, 4, 5, 6];

export const crearConteoZonasVacio = () =>
  Object.fromEntries(ZONAS.map((z) => [z, 0]));

const campoEquipoDesdePunto = (equipoPunto) => {
  const llave = equipoPuntoALlave(equipoPunto);
  if (llave === 'local') return 'equipo_local';
  if (llave === 'visitante') return 'equipo_visitante';
  return null;
};

export const zonaDeJugadorEnPosiciones = (posiciones, campoEquipo, jugadorId) => {
  if (!posiciones || !campoEquipo || jugadorId == null) return null;
  const fila = posiciones[campoEquipo];
  if (!Array.isArray(fila) || fila.length !== 6) return null;
  const idx = fila.findIndex((id) => Number(id) === Number(jugadorId));
  return idx === -1 ? null : idx + 1;
};

export const aplicarCambioEnPosiciones = (posiciones, detalleCambio) => {
  if (!posiciones || !detalleCambio) return posiciones;

  const campoEquipo = campoEquipoDesdePunto(detalleCambio.equipo);
  if (!campoEquipo) return posiciones;

  const salienteId = detalleCambio.saliente_id ?? detalleCambio.jugador_sale_id;
  const entranteId = detalleCambio.entrante_id ?? detalleCambio.jugador_entra_id;
  const actuales = posiciones[campoEquipo];

  if (!Array.isArray(actuales) || salienteId == null || entranteId == null) {
    return posiciones;
  }

  const idx = actuales.findIndex((id) => Number(id) === Number(salienteId));
  if (idx === -1) return posiciones;

  const nextEquipo = [...actuales];
  nextEquipo[idx] = entranteId;

  return {
    ...posiciones,
    [campoEquipo]: nextEquipo,
  };
};

export const resolverCampoEquipoPorTeamId = (participantes, teamId) => {
  if (!Array.isArray(participantes) || teamId == null) return null;
  const fila = participantes.find((p) => Number(p.team_id) === Number(teamId));
  if (!fila) return null;
  return fila.es_local === true ? 'equipo_local' : 'equipo_visitante';
};

export const resolverEquipoPuntoPorTeamId = (participantes, teamId) => {
  const campo = resolverCampoEquipoPorTeamId(participantes, teamId);
  if (campo === 'equipo_local') return 'LOCAL';
  if (campo === 'equipo_visitante') return 'VISITANTE';
  return null;
};

export const resolverCampoEquipoPorJugadorId = (posiciones, jugadorId) => {
  if (jugadorId == null) return null;
  if (zonaDeJugadorEnPosiciones(posiciones, 'equipo_local', jugadorId) != null) {
    return 'equipo_local';
  }
  if (zonaDeJugadorEnPosiciones(posiciones, 'equipo_visitante', jugadorId) != null) {
    return 'equipo_visitante';
  }
  return null;
};

const equipoPuntoDesdeCampo = (campo) => {
  if (campo === 'equipo_local') return 'LOCAL';
  if (campo === 'equipo_visitante') return 'VISITANTE';
  return null;
};

const incrementarRecibidosEquipoPorRival = (conteo, posiciones, campoDefensor, detalle) => {
  let zonaAtrib = 1;

  if (detalle.origen === 'JUGADOR' && detalle.jugador_id != null) {
    const campoAnotador = campoEquipoDesdePunto(detalle.equipo);
    const zonaRival = zonaDeJugadorEnPosiciones(
      posiciones,
      campoAnotador,
      detalle.jugador_id
    );
    if (zonaRival != null) zonaAtrib = zonaRival;
  } else {
    const fila = posiciones?.[campoDefensor];
    if (Array.isArray(fila)) {
      for (let idx = 0; idx < 6; idx += 1) {
        if (fila[idx] != null) {
          zonaAtrib = idx + 1;
          break;
        }
      }
    }
  }

  conteo[zonaAtrib] += 1;
  return 1;
};

const sumarConteoZonas = (conteo) =>
  ZONAS.reduce((acc, zona) => acc + (conteo[zona] ?? 0), 0);

const serializarConteoZonas = (conteo) =>
  ZONAS.map((zona) => ({
    zona,
    count: conteo[zona] ?? 0,
  }));

/**
 * Replay del log de eventos para mapas de calor de un partido.
 *
 * - Jugador (exposición): todos los PUNTO del partido mientras el jugador estaba en cancha.
 * - Equipo (efectividad): PUNTO ganados por el equipo con origen JUGADOR, zona del anotador.
 * - Jugador (recibidos): PUNTO del rival mientras el jugador estaba en cancha, zona del jugador.
 * - Equipo (recibidos): PUNTO del rival; atribuido a la zona defensora homóloga (rival anotó desde zona Z → nuestra zona Z).
 */
export function calcularMapasCalorPartido({
  eventos = [],
  posicionesIniciales = {},
  equipoQueSacaInicial = null,
  participantes = [],
  jugadorId = null,
  teamId = null,
  reglas = null,
  alineacionesPorSet = null,
  historialSaquePorSet = null,
}) {
  const validos = filtrarEventosValidos(ordenarEventos(eventos));
  const reglasEfectivas = {
    ...REGLAS_VOLEY_DEFAULT,
    ...(reglas && typeof reglas === 'object' ? reglas : {}),
  };

  let posiciones = {
    equipo_local: posicionesIniciales.equipo_local
      ? [...posicionesIniciales.equipo_local]
      : null,
    equipo_visitante: posicionesIniciales.equipo_visitante
      ? [...posicionesIniciales.equipo_visitante]
      : null,
  };

  let equipoQueSaca = equipoQueSacaInicial ?? null;

  const exposicionJugador = crearConteoZonasVacio();
  const recibidosJugador = crearConteoZonasVacio();
  const efectividadEquipo = crearConteoZonasVacio();
  const recibidosEquipo = crearConteoZonasVacio();

  const equipoPuntoObjetivo = teamId != null
    ? resolverEquipoPuntoPorTeamId(participantes, teamId)
    : null;
  const campoEquipoObjetivo = teamId != null
    ? resolverCampoEquipoPorTeamId(participantes, teamId)
    : null;

  let puntosEnCanchaJugador = 0;
  let puntosAnotadosEquipoJugador = 0;
  let puntosRecibidosJugador = 0;
  let puntosRivalContraEquipo = 0;
  let marcadorEstado = estadoMarcadorInicial();

  for (const evento of validos) {
    if (evento.tipo_evento === 'CAMBIO') {
      posiciones = aplicarCambioEnPosiciones(posiciones, evento.detalle_json);
      continue;
    }

    if (evento.tipo_evento !== 'PUNTO') continue;

    const detalle = evento.detalle_json ?? {};

    if (jugadorId != null) {
      const campoJugador =
        resolverCampoEquipoPorJugadorId(posiciones, jugadorId);
      const zonaJugador = campoJugador
        ? zonaDeJugadorEnPosiciones(posiciones, campoJugador, jugadorId)
        : null;

      if (zonaJugador != null) {
        exposicionJugador[zonaJugador] += 1;
        puntosEnCanchaJugador += 1;

        const equipoJugador = equipoPuntoDesdeCampo(campoJugador);
        if (equipoJugador && detalle.equipo !== equipoJugador) {
          recibidosJugador[zonaJugador] += 1;
          puntosRecibidosJugador += 1;
        }
      }
    }

    if (
      teamId != null
      && equipoPuntoObjetivo
      && detalle.equipo !== equipoPuntoObjetivo
      && campoEquipoObjetivo
    ) {
      puntosRivalContraEquipo += 1;
      incrementarRecibidosEquipoPorRival(
        recibidosEquipo,
        posiciones,
        campoEquipoObjetivo,
        detalle
      );
    }

    if (
      teamId != null
      && equipoPuntoObjetivo
      && detalle.equipo === equipoPuntoObjetivo
      && detalle.origen === 'JUGADOR'
      && detalle.jugador_id != null
    ) {
      const campoAnotador = campoEquipoDesdePunto(detalle.equipo);
      const zonaAnotador = zonaDeJugadorEnPosiciones(
        posiciones,
        campoAnotador,
        detalle.jugador_id
      );
      if (zonaAnotador != null) {
        efectividadEquipo[zonaAnotador] += 1;
        puntosAnotadosEquipoJugador += 1;
      }
    }

    const estadoRotacion = {
      posiciones_actuales: posiciones,
      equipo_que_saca: equipoQueSaca,
    };
    const siguiente = aplicarRotacionVolleyPorPunto(estadoRotacion, evento);
    posiciones = siguiente.posiciones_actuales;
    equipoQueSaca = siguiente.equipo_que_saca;

    const parcialesAntes = marcadorEstado.metrica_estructura?.parciales_sets?.length ?? 0;
    marcadorEstado = aplicarPunto(marcadorEstado, evento, reglasEfectivas);
    const parcialesDespues = marcadorEstado.metrica_estructura?.parciales_sets?.length ?? 0;

    if (
      alineacionesPorSet
      && parcialesDespues > parcialesAntes
      && marcadorEstado.resultado_principal === 0
    ) {
      const setSiguiente = parcialesDespues + 1;
      const alinSet = obtenerAlineacionSet(alineacionesPorSet, setSiguiente);
      if (alinSet?.equipo_local?.length === 6 && alinSet?.equipo_visitante?.length === 6) {
        posiciones = {
          equipo_local: [...alinSet.equipo_local],
          equipo_visitante: [...alinSet.equipo_visitante],
        };
        const saqueSet = resolverSaqueInicioSet(
          historialSaquePorSet,
          setSiguiente,
          equipoQueSacaInicial
        );
        if (saqueSet) equipoQueSaca = saqueSet;
      }
    }
  }

  const sumaExposicion = sumarConteoZonas(exposicionJugador);
  const sumaRecibidosJugador = sumarConteoZonas(recibidosJugador);
  const sumaEfectividad = sumarConteoZonas(efectividadEquipo);
  const sumaRecibidosEquipo = sumarConteoZonas(recibidosEquipo);

  const bloqueExposicion = {
    zonas: serializarConteoZonas(exposicionJugador),
    total: sumaExposicion,
    validacion: {
      suma_zonas: sumaExposicion,
      total_esperado: puntosEnCanchaJugador,
      cuadra: sumaExposicion === puntosEnCanchaJugador,
      descripcion:
        'Puntos del partido mientras el jugador estaba en cancha (exposición por zona)',
    },
  };

  const bloqueRecibidosJugador = {
    zonas: serializarConteoZonas(recibidosJugador),
    total: sumaRecibidosJugador,
    validacion: {
      suma_zonas: sumaRecibidosJugador,
      total_esperado: puntosRecibidosJugador,
      cuadra: sumaRecibidosJugador === puntosRecibidosJugador,
      descripcion:
        'Puntos del rival mientras el jugador estaba en cancha (recibidos por zona)',
    },
  };

  const bloqueEfectividad = {
    zonas: serializarConteoZonas(efectividadEquipo),
    total: sumaEfectividad,
    validacion: {
      suma_zonas: sumaEfectividad,
      total_esperado: puntosAnotadosEquipoJugador,
      cuadra: sumaEfectividad === puntosAnotadosEquipoJugador,
      descripcion:
        'Puntos anotados por el equipo con origen JUGADOR (efectividad por zona del anotador)',
    },
  };

  const bloqueRecibidosEquipo = {
    zonas: serializarConteoZonas(recibidosEquipo),
    total: puntosRivalContraEquipo,
    validacion: {
      suma_zonas: sumaRecibidosEquipo,
      total_esperado: puntosRivalContraEquipo,
      puntos_rival_partido: puntosRivalContraEquipo,
      cuadra: sumaRecibidosEquipo === puntosRivalContraEquipo,
      descripcion:
        'Puntos recibidos por zona del equipo (zona defensora homóloga al anotador rival; suma = puntos rival)',
    },
  };

  return {
    jugador: jugadorId != null
      ? {
          user_id: Number(jugadorId),
          ...bloqueExposicion,
          exposicion: bloqueExposicion,
          recibidos: bloqueRecibidosJugador,
        }
      : null,
    equipo: teamId != null
      ? {
          team_id: Number(teamId),
          ...bloqueEfectividad,
          efectividad: bloqueEfectividad,
          recibidos: bloqueRecibidosEquipo,
        }
      : null,
  };
}

export { ZONAS, sumarConteoZonas, serializarConteoZonas };
