import {
  sequelize,
  Partidos,
  MarcadoresDetalle,
  EventosPartido,
  PartidoNominas,
  PartidoParticipantes,
  User,
} from '../db/db.js';
import {
  reducirEstadoPartido,
  ordenarEventos,
  filtrarEventosValidos
} from '../services/reducerPartido.js';
import { propagarAvancePartido } from '../services/propagacionFixture.js';
import { procesarPartidoFinalizado } from './partidoFinalizadoService.js';
import { evaluarYRecalcularHorarioTrasFinalizar } from './recalculoHorariosService.js';
import { aplicarSaquePorSetAlEstado } from './saquePorSetService.js';
import { notificarMarcadorEnVivo } from './marcadorEnVivoNotifyService.js';
import {
  cargarAlineacionesPorSet,
  posicionesInicialesSet1,
  resolverPendienteAlineacionSet,
} from './alineacionPorSetService.js';
import {
  filtrarCambiosEquipoEnSet,
  validarSustitucionVoley,
} from './sustitucionesVoleyService.js';

export const DISPOSITIVO_ARBISTRO_APP = '00000000-0000-0000-0000-000000000001';

const EQUIPOS_VALIDOS = ['LOCAL', 'VISITANTE'];
const ORIGENES_VALIDOS = ['JUGADOR', 'ERROR_RIVAL'];
const TIPOS_ACCION_VALIDOS = ['ATAQUE', 'BLOQUEO', 'SAQUE_DIRECTO'];
const TIPOS_ERROR_RIVAL_VALIDOS = ['FUERA', 'RED', 'ERROR_SAQUE'];

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const ordenEventos = [
  ['ocurrido_en_cliente', 'ASC'],
  ['secuencia_local', 'ASC']
];

export const construirOpcionesVolley = (partidoRow, marcador, alineacionesPorSet = null) => {
  const alineaciones = alineacionesPorSet ?? marcador?.metrica_estructura?.alineaciones_por_set ?? null;
  const set1 = posicionesInicialesSet1(alineaciones ?? {});

  return {
    posicionesIniciales: {
      equipo_local: set1.equipo_local
        ?? partidoRow?.alineacion_local
        ?? marcador?.posiciones_actuales?.equipo_local
        ?? null,
      equipo_visitante: set1.equipo_visitante
        ?? partidoRow?.alineacion_visitante
        ?? marcador?.posiciones_actuales?.equipo_visitante
        ?? null,
    },
    alineacionesPorSet: alineaciones,
    historialSaquePorSet: marcador?.metrica_estructura?.saque_primero_por_set ?? null,
    equipoQueSacaInicial: partidoRow?.equipo_que_saca_inicial
      ?? marcador?.equipo_que_saca
      ?? 'local',
  };
};

const cargarParticipantes = async (partidoId, transaction) => {
  return PartidoParticipantes.findAll({
    where: { partido_id: partidoId },
    attributes: ['team_id', 'es_local'],
    transaction
  });
};

const resolverTeamId = (participantes, equipo) => {
  const fila = participantes.find((p) =>
    equipo === 'LOCAL' ? p.es_local === true : p.es_local === false
  );
  return fila?.team_id ?? null;
};

const validarJugadorEnNomina = async (partidoId, teamId, userId, setNumero, transaction) => {
  const fila = await PartidoNominas.findOne({
    where: {
      partido_id: partidoId,
      team_id: teamId,
      user_id: userId,
      set_numero: setNumero,
      estado_validacion: 'VALIDADO'
    },
    transaction
  });
  return Boolean(fila);
};

export const cargarContextoArbitraje = async (partidoId, userId) => {
  if (!partidoId) {
    return { status: 400, message: 'partido_id inválido' };
  }

  const partido = await Partidos.findByPk(partidoId, {
    attributes: ['id', 'arbitro_asignado_id', 'state']
  });

  if (!partido) {
    return { status: 404, message: 'Partido no encontrado' };
  }

  if (partido.arbitro_asignado_id !== userId) {
    return {
      status: 403,
      message: 'Solo el árbitro asignado puede registrar eventos del partido'
    };
  }

  if (partido.state !== 'EN_CURSO') {
    return { status: 400, message: 'El partido no está en curso' };
  }

  const marcador = await MarcadoresDetalle.findOne({
    where: { partido_id: partidoId }
  });

  if (!marcador) {
    return { status: 400, message: 'El partido no ha sido iniciado' };
  }

  if (marcador.resultado_principal !== 0) {
    return {
      status: 400,
      message: 'El partido ya finalizó, no se pueden registrar más eventos'
    };
  }

  return { status: 200, partido, marcador, reglas: marcador.reglas_arbitraje_snapshot };
};

const obtenerSecuenciaSiguiente = async (partidoId, transaction) => {
  const maxSecuencia = await EventosPartido.max('secuencia_local', {
    where: { partido_id: partidoId },
    transaction
  });
  return (maxSecuencia ?? 0) + 1;
};

export const aplicarCierrePartido = async (
  partidoId,
  partido,
  estadoReducido,
  transaction
) => {
  if (estadoReducido.marcador.resultado_principal === 0) {
    return { finalizado: false };
  }

  const yaFinalizado = partido.state === 'FINALIZADO';
  const finalizadoEn = new Date();

  await partido.update(
    {
      state: 'FINALIZADO',
      score_local_final: estadoReducido.marcador.sets_ganados_local,
      score_visitante_final: estadoReducido.marcador.sets_ganados_visitante,
      finalizado_en: finalizadoEn,
    },
    { transaction }
  );

  let recalculoHorario = null;
  if (!yaFinalizado) {
    recalculoHorario = await evaluarYRecalcularHorarioTrasFinalizar(
      partidoId,
      finalizadoEn,
      transaction
    );
  }

  const postProceso = await procesarPartidoFinalizado(partidoId, transaction, {
    actualizarRating: !yaFinalizado,
  });

  if (!yaFinalizado) {
    const { notificarResultadoPartido } = await import('./notificacionesService.js');
    await notificarResultadoPartido(partidoId, transaction);
  }

  return {
    finalizado: true,
    primeraFinalizacion: !yaFinalizado,
    postProceso,
    recalculoHorario,
  };
};

const recalcularMarcadorEnTransaccion = async (partidoId, partido, marcador, reglas, transaction) => {
  const eventos = await EventosPartido.findAll({
    where: { partido_id: partidoId },
    order: ordenEventos,
    transaction
  });

  const partidoRow = await Partidos.findByPk(partidoId, {
    attributes: ['alineacion_local', 'alineacion_visitante', 'equipo_que_saca_inicial'],
    transaction
  });

  const alineacionesPorSet = await cargarAlineacionesPorSet(partidoId, transaction);

  const opcionesVolley = construirOpcionesVolley(partidoRow, marcador, alineacionesPorSet);

  const estadoReducido = reducirEstadoPartido(
    eventos.map((evento) => evento.toJSON()),
    reglas,
    [],
    null,
    opcionesVolley
  );

  aplicarSaquePorSetAlEstado(estadoReducido, marcador, partidoRow);

  const prevPendienteAlineacion = marcador.metrica_estructura?.pendiente_alineacion_set ?? null;
  const pendienteAlineacion = resolverPendienteAlineacionSet(
    estadoReducido.marcador,
    alineacionesPorSet
  );

  if (
    pendienteAlineacion != null
    && pendienteAlineacion !== prevPendienteAlineacion
  ) {
    const { notificarAlineacionPendienteSet } = await import('./notificacionesService.js');
    await notificarAlineacionPendienteSet({
      partidoId,
      setNumero: pendienteAlineacion,
      transaction,
    });
  }

  estadoReducido.marcador.metrica_estructura = {
    ...estadoReducido.marcador.metrica_estructura,
    alineaciones_por_set: alineacionesPorSet,
    pendiente_alineacion_set: pendienteAlineacion,
    ...(pendienteAlineacion
      ? { pendiente_saque_set: null }
      : {}),
  };

  await marcador.update(
    {
      resultado_principal: estadoReducido.marcador.resultado_principal,
      sets_ganados_local: estadoReducido.marcador.sets_ganados_local,
      sets_ganados_visitante: estadoReducido.marcador.sets_ganados_visitante,
      puntos_favor: estadoReducido.marcador.puntos_favor,
      puntos_contra: estadoReducido.marcador.puntos_contra,
      metrica_estructura: estadoReducido.marcador.metrica_estructura,
      posiciones_actuales: estadoReducido.posicionesVolley.posiciones_actuales,
      equipo_que_saca: estadoReducido.posicionesVolley.equipo_que_saca,
      ultimo_evento_id: estadoReducido.ultimo_evento_id_procesado,
      actualizado_en: new Date()
    },
    { transaction }
  );

  await aplicarCierrePartido(partidoId, partido, estadoReducido, transaction);

  return estadoReducido;
};

const buscarUltimoPuntoValido = (eventosJson) => {
  const ordenados = ordenarEventos(eventosJson);
  const validos = filtrarEventosValidos(ordenados);
  const puntos = validos.filter((evento) => evento.tipo_evento === 'PUNTO');
  return puntos.at(-1) ?? null;
};

const construirDetallePunto = (payload) => {
  const detalle = {
    equipo: payload.equipo,
    origen: payload.origen
  };

  if (payload.origen === 'JUGADOR') {
    detalle.jugador_id = payload.jugador_id;
    if (payload.tipo_accion) {
      detalle.tipo_accion = payload.tipo_accion;
    }
  }

  if (payload.origen === 'ERROR_RIVAL' && payload.tipo_error_rival) {
    detalle.tipo_error_rival = payload.tipo_error_rival;
  }

  return detalle;
};

/**
 * POST /api/partidos/:id/eventos/punto
 */
export const ejecutarRegistrarPunto = async (partidoId, userId, body) => {
  const contexto = await cargarContextoArbitraje(partidoId, userId);
  if (contexto.status !== 200) {
    return contexto;
  }

  const equipo = body?.equipo;
  const origen = body?.origen;
  const jugadorId = body?.jugador_id != null ? parseId(body.jugador_id) : null;
  const tipoAccion = body?.tipo_accion ?? null;
  const tipoErrorRival = body?.tipo_error_rival ?? null;

  if (!EQUIPOS_VALIDOS.includes(equipo)) {
    return { status: 400, message: "equipo debe ser 'LOCAL' o 'VISITANTE'" };
  }

  if (!ORIGENES_VALIDOS.includes(origen)) {
    return { status: 400, message: "origen debe ser 'JUGADOR' o 'ERROR_RIVAL'" };
  }

  if (origen === 'JUGADOR' && !jugadorId) {
    return { status: 400, message: 'jugador_id es obligatorio cuando origen es JUGADOR' };
  }

  if (origen === 'ERROR_RIVAL' && jugadorId) {
    return { status: 400, message: 'jugador_id debe ser null cuando origen es ERROR_RIVAL' };
  }

  if (tipoAccion != null && !TIPOS_ACCION_VALIDOS.includes(tipoAccion)) {
    return {
      status: 400,
      message: "tipo_accion debe ser 'ATAQUE', 'BLOQUEO' o 'SAQUE_DIRECTO'"
    };
  }

  if (tipoErrorRival != null && !TIPOS_ERROR_RIVAL_VALIDOS.includes(tipoErrorRival)) {
    return {
      status: 400,
      message: "tipo_error_rival debe ser 'FUERA', 'RED' o 'ERROR_SAQUE'"
    };
  }

  const { partido, marcador, reglas } = contexto;

  const pendienteSaque = marcador.metrica_estructura?.pendiente_saque_set;
  if (pendienteSaque) {
    return {
      status: 400,
      message: `Debes indicar quién saca primero en el set ${pendienteSaque} antes de continuar`,
    };
  }

  const pendienteAlineacion = marcador.metrica_estructura?.pendiente_alineacion_set;
  if (pendienteAlineacion) {
    return {
      status: 400,
      message: `Ambos equipos deben confirmar la alineación del set ${pendienteAlineacion} antes de continuar`,
    };
  }

  const setActual = (marcador.metrica_estructura?.parciales_sets?.length ?? 0) + 1;

  const resultadoTransaccion = await sequelize.transaction(async (transaction) => {
    const participantes = await cargarParticipantes(partidoId, transaction);
    const teamId = resolverTeamId(participantes, equipo);

    if (!teamId) {
      return { status: 400, message: `No se encontró equipo ${equipo} en este partido` };
    }

    if (origen === 'JUGADOR') {
      const valido = await validarJugadorEnNomina(
        partidoId,
        teamId,
        jugadorId,
        setActual,
        transaction
      );
      if (!valido) {
        return {
          status: 400,
          message: 'El jugador no está en la nómina validada del equipo que anota'
        };
      }
    }

    const secuencia = await obtenerSecuenciaSiguiente(partidoId, transaction);
    const ocurridoEn = new Date();

    const evento = await EventosPartido.create(
      {
        partido_id: partidoId,
        dispositivo_id: DISPOSITIVO_ARBISTRO_APP,
        secuencia_local: secuencia,
        tipo_evento: 'PUNTO',
        actor_principal_id: origen === 'JUGADOR' ? jugadorId : userId,
        detalle_json: construirDetallePunto({
          equipo,
          origen,
          jugador_id: jugadorId,
          tipo_accion: tipoAccion,
          tipo_error_rival: tipoErrorRival
        }),
        ocurrido_en_cliente: ocurridoEn
      },
      { transaction }
    );

    const estadoReducido = await recalcularMarcadorEnTransaccion(
      partidoId,
      partido,
      marcador,
      reglas,
      transaction
    );

    return { status: 200, evento, estadoReducido };
  });

  if (resultadoTransaccion.status !== 200) {
    return resultadoTransaccion;
  }

  let propagacion = null;
  if (resultadoTransaccion.estadoReducido.marcador.resultado_principal !== 0) {
    propagacion = await propagarAvancePartido(
      partidoId,
      resultadoTransaccion.estadoReducido.marcador.resultado_principal
    );
  }

  await marcador.reload();

  await notificarMarcadorEnVivo(partidoId, {
    marcador,
    partido,
    ultimoPunto: resultadoTransaccion.evento,
  });

  return {
    status: 200,
    marcador: marcador.toJSON(),
    evento: resultadoTransaccion.evento.toJSON(),
    partido_finalizado: resultadoTransaccion.estadoReducido.marcador.resultado_principal !== 0,
    propagacion
  };
};

/**
 * POST /api/partidos/:id/eventos/deshacer
 */
export const ejecutarDeshacerUltimoPunto = async (partidoId, userId) => {
  const contexto = await cargarContextoArbitraje(partidoId, userId);
  if (contexto.status !== 200) {
    return contexto;
  }

  const { partido, marcador, reglas } = contexto;

  const resultadoTransaccion = await sequelize.transaction(async (transaction) => {
    const eventos = await EventosPartido.findAll({
      where: { partido_id: partidoId },
      order: ordenEventos,
      transaction
    });

    const ultimoPunto = buscarUltimoPuntoValido(eventos.map((evento) => evento.toJSON()));

    if (!ultimoPunto) {
      return { status: 400, message: 'No hay puntos para deshacer' };
    }

    const secuencia = await obtenerSecuenciaSiguiente(partidoId, transaction);

    const eventoAnulacion = await EventosPartido.create(
      {
        partido_id: partidoId,
        dispositivo_id: DISPOSITIVO_ARBISTRO_APP,
        secuencia_local: secuencia,
        tipo_evento: 'ANULACION_EVENTO',
        actor_principal_id: userId,
        detalle_json: { evento_anulado_id: ultimoPunto.id },
        ocurrido_en_cliente: new Date()
      },
      { transaction }
    );

    const estadoReducido = await recalcularMarcadorEnTransaccion(
      partidoId,
      partido,
      marcador,
      reglas,
      transaction
    );

    return { status: 200, eventoAnulacion, puntoAnulado: ultimoPunto, estadoReducido };
  });

  if (resultadoTransaccion.status !== 200) {
    return resultadoTransaccion;
  }

  await marcador.reload();

  await notificarMarcadorEnVivo(partidoId, { marcador, partido });

  return {
    status: 200,
    marcador: marcador.toJSON(),
    evento: resultadoTransaccion.eventoAnulacion.toJSON(),
    punto_anulado_id: resultadoTransaccion.puntoAnulado.id
  };
};

/**
 * POST /api/partidos/:id/eventos/cambio
 */
export const ejecutarRegistrarCambio = async (partidoId, userId, body) => {
  const contexto = await cargarContextoArbitraje(partidoId, userId);
  if (contexto.status !== 200) {
    return contexto;
  }

  const equipo = body?.equipo;
  const jugadorSaleId = parseId(body?.jugador_sale_id);
  const jugadorEntraId = parseId(body?.jugador_entra_id);

  if (!EQUIPOS_VALIDOS.includes(equipo)) {
    return { status: 400, message: "equipo debe ser 'LOCAL' o 'VISITANTE'" };
  }

  if (!jugadorSaleId || !jugadorEntraId) {
    return {
      status: 400,
      message: 'jugador_sale_id y jugador_entra_id son obligatorios'
    };
  }

  if (jugadorSaleId === jugadorEntraId) {
    return { status: 400, message: 'El jugador que sale y el que entra deben ser distintos' };
  }

  const { partido, marcador, reglas } = contexto;
  const setActual = (marcador.metrica_estructura?.parciales_sets?.length ?? 0) + 1;

  const resultadoTransaccion = await sequelize.transaction(async (transaction) => {
    const participantes = await cargarParticipantes(partidoId, transaction);
    const teamId = resolverTeamId(participantes, equipo);

    if (!teamId) {
      return { status: 400, message: `No se encontró equipo ${equipo} en este partido` };
    }

    const saleValido = await validarJugadorEnNomina(
      partidoId,
      teamId,
      jugadorSaleId,
      setActual,
      transaction
    );
    const entraValido = await validarJugadorEnNomina(
      partidoId,
      teamId,
      jugadorEntraId,
      setActual,
      transaction
    );

    if (!saleValido || !entraValido) {
      return {
        status: 400,
        message: 'Ambos jugadores deben estar en la nómina validada del equipo'
      };
    }

    const eventosRows = await EventosPartido.findAll({
      where: { partido_id: partidoId },
      order: [
        ['ocurrido_en_cliente', 'ASC'],
        ['secuencia_local', 'ASC'],
      ],
      transaction,
    });
    const eventosValidos = filtrarEventosValidos(ordenarEventos(eventosRows.map((e) => e.toJSON())));
    const cambiosSet = filtrarCambiosEquipoEnSet(eventosValidos, setActual, equipo, reglas ?? {});

    const nominasRows = await PartidoNominas.findAll({
      where: {
        partido_id: partidoId,
        team_id: teamId,
        set_numero: setActual,
        estado_validacion: 'VALIDADO',
      },
      include: [{
        model: User,
        as: 'jugador',
        attributes: ['id', 'name', 'nick'],
      }],
      transaction,
    });
    const nombresPorId = Object.fromEntries(
      nominasRows.map((n) => {
        const row = n.toJSON();
        const nombre = row.jugador?.name ?? row.jugador?.nick ?? `Jugador #${row.user_id}`;
        return [row.user_id, nombre];
      })
    );

    const validacionCambio = validarSustitucionVoley(
      cambiosSet,
      jugadorSaleId,
      jugadorEntraId,
      nombresPorId
    );
    if (!validacionCambio.valido) {
      return { status: 400, message: validacionCambio.motivo };
    }

    const secuencia = await obtenerSecuenciaSiguiente(partidoId, transaction);

    const evento = await EventosPartido.create(
      {
        partido_id: partidoId,
        dispositivo_id: DISPOSITIVO_ARBISTRO_APP,
        secuencia_local: secuencia,
        tipo_evento: 'CAMBIO',
        actor_principal_id: jugadorSaleId,
        actor_secundario_id: jugadorEntraId,
        detalle_json: {
          equipo,
          saliente_id: jugadorSaleId,
          entrante_id: jugadorEntraId,
          set_numero: setActual,
        },
        ocurrido_en_cliente: new Date()
      },
      { transaction }
    );

    const marcadorActual = await MarcadoresDetalle.findOne({
      where: { partido_id: partidoId },
      transaction
    });

    return {
      status: 200,
      evento,
      marcador: {
        resultado_principal: marcadorActual.resultado_principal,
        sets_ganados_local: marcadorActual.sets_ganados_local,
        sets_ganados_visitante: marcadorActual.sets_ganados_visitante,
        puntos_favor: marcadorActual.puntos_favor,
        puntos_contra: marcadorActual.puntos_contra,
        metrica_estructura: marcadorActual.metrica_estructura
      }
    };
  });

  if (resultadoTransaccion.status !== 200) {
    return resultadoTransaccion;
  }

  return {
    status: 200,
    marcador: resultadoTransaccion.marcador,
    evento: resultadoTransaccion.evento.toJSON()
  };
};

/**
 * PATCH /api/partidos/:id/eventos/:evento_id/detalle
 * Agrega tipo_accion o tipo_error_rival a un punto ya registrado.
 */
export const ejecutarActualizarDetalleEvento = async (partidoId, eventoId, userId, body) => {
  const contexto = await cargarContextoArbitraje(partidoId, userId);
  if (contexto.status !== 200) {
    return contexto;
  }

  const tipoAccion = body?.tipo_accion ?? null;
  const tipoErrorRival = body?.tipo_error_rival ?? null;

  if (!tipoAccion && !tipoErrorRival) {
    return { status: 400, message: 'Debes enviar tipo_accion o tipo_error_rival' };
  }

  if (tipoAccion && !TIPOS_ACCION_VALIDOS.includes(tipoAccion)) {
    return {
      status: 400,
      message: "tipo_accion debe ser 'ATAQUE', 'BLOQUEO' o 'SAQUE_DIRECTO'"
    };
  }

  if (tipoErrorRival && !TIPOS_ERROR_RIVAL_VALIDOS.includes(tipoErrorRival)) {
    return {
      status: 400,
      message: "tipo_error_rival debe ser 'FUERA', 'RED' o 'ERROR_SAQUE'"
    };
  }

  const evento = await EventosPartido.findOne({
    where: { id: eventoId, partido_id: partidoId }
  });

  if (!evento) {
    return { status: 404, message: 'Evento no encontrado' };
  }

  if (evento.tipo_evento !== 'PUNTO') {
    return { status: 400, message: 'Solo se puede detallar eventos de tipo PUNTO' };
  }

  const detalle = { ...evento.detalle_json };

  if (tipoAccion) {
    if (detalle.origen !== 'JUGADOR') {
      return { status: 400, message: 'tipo_accion solo aplica a puntos de origen JUGADOR' };
    }
    detalle.tipo_accion = tipoAccion;
  }

  if (tipoErrorRival) {
    if (detalle.origen !== 'ERROR_RIVAL') {
      return { status: 400, message: 'tipo_error_rival solo aplica a puntos de origen ERROR_RIVAL' };
    }
    detalle.tipo_error_rival = tipoErrorRival;
  }

  await evento.update({ detalle_json: detalle });

  return { status: 200, evento: evento.toJSON() };
};

const TARJETAS_VALIDAS = ['AMARILLA', 'ROJA'];

/**
 * POST /api/partidos/:id/eventos/sancion
 * Registra tarjeta; corre el reducer de sanciones sin alterar el marcador de puntos.
 */
export const ejecutarRegistrarSancion = async (partidoId, userId, body) => {
  const contexto = await cargarContextoArbitraje(partidoId, userId);
  if (contexto.status !== 200) {
    return contexto;
  }

  const jugadorId = parseId(body?.jugador_id);
  const tipo = body?.tipo ? String(body.tipo).toUpperCase() : null;

  if (!jugadorId) {
    return { status: 400, message: 'jugador_id es obligatorio' };
  }

  if (!TARJETAS_VALIDAS.includes(tipo)) {
    return { status: 400, message: "tipo debe ser 'AMARILLA' o 'ROJA'" };
  }

  const { partido, marcador, reglas } = contexto;

  const marcadorAntes = {
    puntos_favor: marcador.puntos_favor,
    puntos_contra: marcador.puntos_contra,
    sets_ganados_local: marcador.sets_ganados_local,
    sets_ganados_visitante: marcador.sets_ganados_visitante,
    resultado_principal: marcador.resultado_principal,
  };

  const resultadoTransaccion = await sequelize.transaction(async (transaction) => {
    const nomina = await PartidoNominas.findOne({
      where: {
        partido_id: partidoId,
        user_id: jugadorId,
        estado_validacion: 'VALIDADO',
      },
      transaction,
    });

    if (!nomina) {
      return {
        status: 400,
        message: 'El jugador debe estar en la nómina validada del partido',
      };
    }

    const secuencia = await obtenerSecuenciaSiguiente(partidoId, transaction);

    const esVoley = Boolean(reglas?.puntos_por_set);
    const detalleJson = { tarjeta: tipo };
    if (esVoley) {
      detalleJson.set_numero =
        (marcador.metrica_estructura?.parciales_sets?.length ?? 0) + 1;
    }

    const evento = await EventosPartido.create(
      {
        partido_id: partidoId,
        dispositivo_id: DISPOSITIVO_ARBISTRO_APP,
        secuencia_local: secuencia,
        tipo_evento: 'SANCION',
        actor_principal_id: jugadorId,
        detalle_json: detalleJson,
        ocurrido_en_cliente: new Date(),
      },
      { transaction }
    );

    const eventos = await EventosPartido.findAll({
      where: { partido_id: partidoId },
      order: ordenEventos,
      transaction,
    });

    const estadoReducido = reducirEstadoPartido(
      eventos.map((evt) => evt.toJSON()),
      reglas,
      [],
      null
    );

    const metricaEstructura = {
      ...(marcador.metrica_estructura ?? {}),
      sanciones: estadoReducido.sanciones,
    };

    await marcador.update(
      {
        ultimo_evento_id: evento.id,
        metrica_estructura: metricaEstructura,
        actualizado_en: new Date(),
      },
      { transaction }
    );

    return { status: 200, evento, sanciones: estadoReducido.sanciones };
  });

  if (resultadoTransaccion.status !== 200) {
    return resultadoTransaccion;
  }

  return {
    status: 200,
    evento: resultadoTransaccion.evento.toJSON(),
    sanciones: resultadoTransaccion.sanciones,
    marcador: marcadorAntes,
  };
};
