import {
  Partidos,
  EventosPartido,
  PartidoParticipantes,
  MarcadoresDetalle,
  PartidoNominas,
} from '../db/db.js';
import { construirOpcionesVolley } from './eventosPartidoService.js';
import { calcularMapasCalorPartido } from './mapasCalorService.js';
import { cargarAlineacionesPorSet } from './alineacionPorSetService.js';
import {
  filtrarEventosPorSet,
  resolverSetNumeroEvento,
} from './sustitucionesVoleyService.js';
import {
  ordenarEventos,
  filtrarEventosValidos,
} from './reducerPartido.js';
import {
  obtenerEntradaHistorial,
  asegurarHistorialSet1,
} from './saquePorSetService.js';

const ordenEventos = [
  ['ocurrido_en_cliente', 'ASC'],
  ['secuencia_local', 'ASC'],
];

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

async function buildFromNominasSet(partidoId, teamId, setNumero) {
  if (!teamId) return null;
  const nominas = await PartidoNominas.findAll({
    where: {
      partido_id: partidoId,
      team_id: teamId,
      rol_nomina: 'TITULAR',
      estado_validacion: 'VALIDADO',
      set_numero: setNumero,
    },
    attributes: ['user_id', 'zona'],
  });
  if (nominas.length < 6) return null;
  const arr = Array(6).fill(null);
  for (const n of nominas) {
    if (n.zona >= 1 && n.zona <= 6) arr[n.zona - 1] = n.user_id;
  }
  return arr.every(Boolean) ? arr : null;
}

async function construirPosicionesIniciales(partidoId, partidoRow, marcadorRow, setNumero = 1) {
  const alineacionesPorSet = await cargarAlineacionesPorSet(partidoId);
  const alinSet = alineacionesPorSet[setNumero] ?? alineacionesPorSet[String(setNumero)];

  if (alinSet?.equipo_local?.length === 6 && alinSet?.equipo_visitante?.length === 6) {
    return alinSet;
  }

  const opciones = construirOpcionesVolley(partidoRow, marcadorRow, alineacionesPorSet);
  if (setNumero === 1) {
    const posiciones = opciones.posicionesIniciales;
    if (posiciones?.equipo_local?.length === 6 && posiciones?.equipo_visitante?.length === 6) {
      return posiciones;
    }
  }

  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partidoId },
    attributes: ['team_id', 'es_local'],
  });

  const porEquipo = { local: [], visitante: [] };
  for (const p of participantes) {
    const bucket = p.es_local === true ? 'local' : 'visitante';
    porEquipo[bucket].push(p.team_id);
  }

  return {
    equipo_local: alinSet?.equipo_local
      ?? await buildFromNominasSet(partidoId, porEquipo.local[0], setNumero),
    equipo_visitante: alinSet?.equipo_visitante
      ?? await buildFromNominasSet(partidoId, porEquipo.visitante[0], setNumero),
  };
}

function resolverEquipoQueSacaSet(opciones, partidoRow, setNumero) {
  const historial = asegurarHistorialSet1(
    opciones.historialSaquePorSet,
    partidoRow?.equipo_que_saca_inicial ?? opciones.equipoQueSacaInicial
  );
  const entrada = obtenerEntradaHistorial(historial, setNumero);
  if (entrada?.equipo) return entrada.equipo;
  if (setNumero === 1) return opciones.equipoQueSacaInicial ?? null;
  return null;
}

function resolverSetsJugados(marcador, eventosValidos = [], reglas = {}) {
  const parciales = marcador?.metrica_estructura?.parciales_sets ?? [];
  const setsCompletados = Array.isArray(parciales) ? parciales.length : 0;
  let maxSet = setsCompletados;

  for (const evento of eventosValidos) {
    if (evento.tipo_evento !== 'PUNTO' && evento.tipo_evento !== 'CAMBIO') continue;
    const setNum = resolverSetNumeroEvento(evento, eventosValidos, reglas);
    if (setNum != null) maxSet = Math.max(maxSet, setNum);
  }

  if (maxSet > 0) return maxSet;

  const partidoEnCurso = marcador?.resultado_principal === 0;
  const puntosEnSet = (marcador?.puntos_favor ?? 0) + (marcador?.puntos_contra ?? 0);
  if (partidoEnCurso && puntosEnSet > 0) {
    return Math.max(setsCompletados + 1, 1);
  }

  return Math.max(setsCompletados, 1);
}

export async function obtenerMapasCalorPartido(
  partidoId,
  { jugadorId = null, teamId = null, setNumero = null } = {}
) {
  const id = parseId(partidoId);
  if (!id) {
    return { status: 400, message: 'partido_id inválido' };
  }

  if (jugadorId == null && teamId == null) {
    return { status: 400, message: 'Debe indicar jugador_id o team_id' };
  }

  const setFiltro = setNumero != null ? parseId(setNumero) : null;
  if (setNumero != null && (setFiltro == null || setFiltro < 1)) {
    return { status: 400, message: 'set_numero inválido' };
  }

  const partido = await Partidos.findByPk(id, {
    attributes: [
      'id',
      'state',
      'alineacion_local',
      'alineacion_visitante',
      'equipo_que_saca_inicial',
    ],
  });

  if (!partido) {
    return { status: 404, message: 'Partido no encontrado' };
  }

  const marcador = await MarcadoresDetalle.findOne({ where: { partido_id: id } });
  const eventos = await EventosPartido.findAll({
    where: { partido_id: id },
    order: ordenEventos,
  });

  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: id },
    attributes: ['team_id', 'es_local'],
  });

  const alineacionesPorSet = await cargarAlineacionesPorSet(id);
  const opciones = construirOpcionesVolley(partido, marcador, alineacionesPorSet);
  const reglas = {
    puntos_por_set: 25,
    ventaja_obligatoria: 2,
    sets_para_ganar: 3,
    ...(marcador?.reglas_arbitraje_snapshot && typeof marcador.reglas_arbitraje_snapshot === 'object'
      ? marcador.reglas_arbitraje_snapshot
      : {}),
  };

  const setInicial = setFiltro ?? 1;
  const posicionesIniciales = await construirPosicionesIniciales(
    id,
    partido,
    marcador,
    setInicial
  );

  if (!posicionesIniciales?.equipo_local?.length
    || !posicionesIniciales?.equipo_visitante?.length) {
    return {
      status: 400,
      message: 'No hay alineación inicial disponible para reconstruir rotaciones',
    };
  }

  let eventosParaReplay = eventos.map((e) => e.toJSON());
  let equipoQueSacaInicial = opciones.equipoQueSacaInicial;
  const eventosValidosCompletos = filtrarEventosValidos(ordenarEventos(eventosParaReplay));

  if (setFiltro != null) {
    eventosParaReplay = filtrarEventosPorSet(eventosValidosCompletos, setFiltro, reglas);
    equipoQueSacaInicial = resolverEquipoQueSacaSet(opciones, partido, setFiltro);
  }

  const mapas = calcularMapasCalorPartido({
    eventos: eventosParaReplay,
    posicionesIniciales,
    equipoQueSacaInicial,
    participantes: participantes.map((p) => p.toJSON()),
    jugadorId: jugadorId != null ? parseId(jugadorId) : null,
    teamId: teamId != null ? parseId(teamId) : null,
    reglas,
    alineacionesPorSet,
    historialSaquePorSet: opciones.historialSaquePorSet,
  });

  return {
    status: 200,
    partido_id: id,
    set_numero: setFiltro,
    sets_jugados: resolverSetsJugados(marcador, eventosValidosCompletos, reglas),
    ...mapas,
  };
}
