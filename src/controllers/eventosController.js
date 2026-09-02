import {
  sequelize,
  Partidos,
  MarcadoresDetalle,
  EventosPartido
} from '../db/db.js';
import {
  reducirEstadoPartido,
  equipoGanaSet,
  resolverPuntosPorSet
} from '../services/reducerPartido.js';
import { propagarAvancePartido } from '../services/propagacionFixture.js';
import {
  ejecutarRegistrarPunto,
  ejecutarDeshacerUltimoPunto,
  ejecutarRegistrarCambio,
  ejecutarActualizarDetalleEvento,
  ejecutarRegistrarSancion,
  construirOpcionesVolley,
  aplicarCierrePartido,
} from '../services/eventosPartidoService.js';
import { notificarMarcadorEnVivo } from '../services/marcadorEnVivoNotifyService.js';
import { aplicarSaquePorSetAlEstado } from '../services/saquePorSetService.js';

const DISPOSITIVO_SINTETICO_ID = '00000000-0000-0000-0000-000000000000';

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const parsePuntos = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const puntos = parseInt(value, 10);
  if (Number.isNaN(puntos) || puntos < 0) {
    return null;
  }

  return puntos;
};

const contextoSetsMarcador = (marcador) => ({
  sets_ganados_local: marcador.sets_ganados_local,
  sets_ganados_visitante: marcador.sets_ganados_visitante
});

const generarPayloadsEventosPunto = (
  partidoId,
  puntosLocal,
  puntosVisitante,
  ganador,
  userId,
  secuenciaInicial
) => {
  const ocurridoEn = new Date();
  const payloads = [];
  let secuencia = secuenciaInicial;

  const puntosPerdedor = ganador === 'LOCAL' ? puntosVisitante : puntosLocal;
  const puntosGanador = ganador === 'LOCAL' ? puntosLocal : puntosVisitante;
  const equipoPerdedor = ganador === 'LOCAL' ? 'VISITANTE' : 'LOCAL';
  const equipoGanador = ganador;

  for (let i = 0; i < puntosPerdedor; i += 1) {
    payloads.push({
      partido_id: partidoId,
      dispositivo_id: DISPOSITIVO_SINTETICO_ID,
      secuencia_local: secuencia,
      tipo_evento: 'PUNTO',
      actor_principal_id: userId,
      detalle_json: { equipo: equipoPerdedor },
      ocurrido_en_cliente: ocurridoEn
    });
    secuencia += 1;
  }

  for (let i = 0; i < puntosGanador; i += 1) {
    payloads.push({
      partido_id: partidoId,
      dispositivo_id: DISPOSITIVO_SINTETICO_ID,
      secuencia_local: secuencia,
      tipo_evento: 'PUNTO',
      actor_principal_id: userId,
      detalle_json: { equipo: equipoGanador },
      ocurrido_en_cliente: ocurridoEn
    });
    secuencia += 1;
  }

  return payloads;
};

/**
 * Registra el resultado final de un set jugado (reutilizable fuera del handler HTTP).
 */
export const ejecutarRegistrarSet = async (partidoId, userId, puntosLocal, puntosVisitante) => {
  if (!partidoId) {
    return { status: 400, message: 'partido_id inválido' };
  }

  if (puntosLocal === null || puntosVisitante === null) {
    return {
      status: 400,
      message: 'puntos_local y puntos_visitante son obligatorios y deben ser enteros >= 0'
    };
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

  const marcador = await MarcadoresDetalle.findOne({
    where: { partido_id: partidoId }
  });

  if (!marcador) {
    return {
      status: 400,
      message: 'El partido no ha sido iniciado'
    };
  }

  if (marcador.resultado_principal !== 0) {
    return {
      status: 400,
      message: 'El partido ya finalizó, no se pueden registrar más sets'
    };
  }

  if (partido.state !== 'EN_CURSO') {
    return {
      status: 400,
      message: 'El partido no está en curso'
    };
  }

  const reglas = marcador.reglas_arbitraje_snapshot;
  const contextoSets = contextoSetsMarcador(marcador);
  const ganadorSet = equipoGanaSet(puntosLocal, puntosVisitante, reglas, contextoSets);

  if (!ganadorSet) {
    const puntosPorSet = resolverPuntosPorSet(
      reglas,
      marcador.sets_ganados_local,
      marcador.sets_ganados_visitante
    );

    return {
      status: 400,
      message: `Marcador inválido: no cierra el set según las reglas configuradas (${puntosPorSet} pts, ventaja ${reglas.ventaja_obligatoria}).`
    };
  }

  const resultadoTransaccion = await sequelize.transaction(async (transaction) => {
    const maxSecuencia = await EventosPartido.max('secuencia_local', {
      where: { partido_id: partidoId },
      transaction
    });

    const secuenciaInicial = (maxSecuencia ?? 0) + 1;
    const payloads = generarPayloadsEventosPunto(
      partidoId,
      puntosLocal,
      puntosVisitante,
      ganadorSet,
      userId,
      secuenciaInicial
    );

    await EventosPartido.bulkCreate(payloads, { transaction });

    const eventos = await EventosPartido.findAll({
      where: { partido_id: partidoId },
      order: [
        ['ocurrido_en_cliente', 'ASC'],
        ['secuencia_local', 'ASC']
      ],
      transaction
    });

    const partidoRow = await Partidos.findByPk(partidoId, {
      attributes: ['alineacion_local', 'alineacion_visitante', 'equipo_que_saca_inicial'],
      transaction
    });
    const opcionesVolley = construirOpcionesVolley(partidoRow, marcador);

    const estadoReducido = reducirEstadoPartido(
      eventos.map((evento) => evento.toJSON()),
      reglas,
      [],
      null,
      opcionesVolley
    );

    aplicarSaquePorSetAlEstado(estadoReducido, marcador, partidoRow);

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
  });

  let propagacion = null;

  if (resultadoTransaccion.marcador.resultado_principal !== 0) {
    propagacion = await propagarAvancePartido(
      partidoId,
      resultadoTransaccion.marcador.resultado_principal
    );
  }

  await notificarMarcadorEnVivo(partidoId);

  return {
    status: 200,
    marcador: resultadoTransaccion.marcador,
    propagacion
  };
};

/**
 * POST /api/partidos/:id/eventos/set
 */
export const registrarSetPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const puntosLocal = parsePuntos(req.body?.puntos_local);
    const puntosVisitante = parsePuntos(req.body?.puntos_visitante);

    const resultado = await ejecutarRegistrarSet(
      partidoId,
      req.userId,
      puntosLocal,
      puntosVisitante
    );

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.message
      });
    }

    return res.status(200).json({
      success: true,
      marcador: resultado.marcador
    });
  } catch (error) {
    console.error('Error en registrarSetPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar el set',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const responderEventoMarcador = (res, resultado, etiquetaError) => {
  if (resultado.status !== 200) {
    return res.status(resultado.status).json({
      success: false,
      message: resultado.message
    });
  }

  const payload = {
    success: true,
    marcador: resultado.marcador
  };

  if (resultado.evento) payload.evento = resultado.evento;
  if (resultado.partido_finalizado != null) payload.partido_finalizado = resultado.partido_finalizado;
  if (resultado.punto_anulado_id) payload.punto_anulado_id = resultado.punto_anulado_id;

  return res.status(200).json(payload);
};

/**
 * POST /api/partidos/:id/eventos/punto
 */
export const registrarPuntoPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const resultado = await ejecutarRegistrarPunto(partidoId, req.userId, req.body);
    return responderEventoMarcador(res, resultado, 'registrar punto');
  } catch (error) {
    console.error('Error en registrarPuntoPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar el punto',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/partidos/:id/eventos/deshacer
 */
export const deshacerUltimoPuntoPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const resultado = await ejecutarDeshacerUltimoPunto(partidoId, req.userId);
    return responderEventoMarcador(res, resultado, 'deshacer punto');
  } catch (error) {
    console.error('Error en deshacerUltimoPuntoPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al deshacer el último punto',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/partidos/:id/eventos/cambio
 */
export const registrarCambioPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const resultado = await ejecutarRegistrarCambio(partidoId, req.userId, req.body);
    return responderEventoMarcador(res, resultado, 'registrar cambio');
  } catch (error) {
    console.error('Error en registrarCambioPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar el cambio',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/partidos/:id/eventos/sancion
 */
export const registrarSancionPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const resultado = await ejecutarRegistrarSancion(partidoId, req.userId, req.body);

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.message,
      });
    }

    return res.status(200).json({
      success: true,
      evento: resultado.evento,
      sanciones: resultado.sanciones,
      marcador: resultado.marcador,
    });
  } catch (error) {
    console.error('Error en registrarSancionPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar la sanción',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
/**
 * PATCH /api/partidos/:id/eventos/:evento_id/detalle
 */
export const actualizarDetalleEventoPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const eventoId = req.params.evento_id;
    const resultado = await ejecutarActualizarDetalleEvento(
      partidoId,
      eventoId,
      req.userId,
      req.body
    );

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.message
      });
    }

    return res.status(200).json({
      success: true,
      evento: resultado.evento
    });
  } catch (error) {
    console.error('Error en actualizarDetalleEventoPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar detalle del evento',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
