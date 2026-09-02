import {
  Partidos,
  Torneos,
  PartidoNominas,
  MarcadoresDetalle,
  PartidoParticipantes,
  Team,
  User,
  Sports,
  sequelize
} from '../db/db.js';
import { obtenerDetalleMarcadorPartido } from '../services/partidoDetalleService.js';
import { obtenerMapasCalorPartido } from '../services/mapasCalorPartidoService.js';
import { notificarMarcadorEnVivo } from '../services/marcadorEnVivoNotifyService.js';
import {
  notificarAsignacionArbitro,
  notificarRespuestaAsignacionArbitro,
} from '../services/notificacionesService.js';
import {
  obtenerDetalleAsignacionArbitro,
  responderConfirmacionArbitro,
} from '../services/asignacionArbitroService.js';
import { usuarioEnCuerpoArbitral } from './torneoArbitrosController.js';
import { cargarAlineacionesPorSet } from '../services/alineacionPorSetService.js';

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const REGLAS_ARBITRAJE_DEFAULT = {
  puntos_por_set: 25,
  ventaja_obligatoria: 2,
  sets_para_ganar: 3
};

const LLAVES_REGLAS_ARBITRAJE = ['puntos_por_set', 'ventaja_obligatoria', 'sets_para_ganar'];

export const resolverReglasArbitrajeSnapshot = (reglasJson) => {
  if (!reglasJson || typeof reglasJson !== 'object') {
    return { ...REGLAS_ARBITRAJE_DEFAULT };
  }

  const tieneTodasLasLlaves = LLAVES_REGLAS_ARBITRAJE.every(
    (llave) => reglasJson[llave] !== undefined && reglasJson[llave] !== null
  );

  if (!tieneTodasLasLlaves) {
    return { ...REGLAS_ARBITRAJE_DEFAULT };
  }

  const snapshot = {
    puntos_por_set: reglasJson.puntos_por_set,
    ventaja_obligatoria: reglasJson.ventaja_obligatoria,
    sets_para_ganar: reglasJson.sets_para_ganar,
  };

  if (reglasJson.puntos_set_decisivo != null) {
    snapshot.puntos_set_decisivo = reglasJson.puntos_set_decisivo;
  }

  return snapshot;
};

const EQUIPOS_SACA_VALIDOS = ['local', 'visitante'];

/**
 * Lógica reutilizable: árbitro define quién saca primero (antes de iniciar).
 */
export const ejecutarDefinirEquipoQueSacaInicial = async (partidoId, userId, equipo) => {
  if (!partidoId) {
    return { status: 400, message: 'partido_id inválido' };
  }

  if (!EQUIPOS_SACA_VALIDOS.includes(equipo)) {
    return {
      status: 400,
      message: "equipo debe ser 'local' o 'visitante'"
    };
  }

  const partido = await Partidos.findByPk(partidoId, {
    attributes: ['id', 'arbitro_asignado_id', 'state', 'equipo_que_saca_inicial']
  });

  if (!partido) {
    return { status: 404, message: 'Partido no encontrado' };
  }

  if (partido.arbitro_asignado_id == null) {
    return {
      status: 400,
      message: 'Este partido no tiene árbitro asignado.'
    };
  }

  if (partido.arbitro_asignado_id !== userId) {
    return {
      status: 403,
      message: 'Solo el árbitro asignado puede definir quién saca primero'
    };
  }

  const state = partido.state ?? 'PROGRAMADO';
  if (state !== 'PROGRAMADO' && state !== 'pendiente') {
    return {
      status: 400,
      message: 'Solo se puede definir el saque inicial antes de iniciar el partido'
    };
  }

  const marcadorExistente = await MarcadoresDetalle.findOne({
    where: { partido_id: partidoId },
    attributes: ['id']
  });

  if (marcadorExistente) {
    return {
      status: 400,
      message: 'Este partido ya fue iniciado'
    };
  }

  await partido.update({ equipo_que_saca_inicial: equipo });

  return {
    status: 200,
    equipo_que_saca_inicial: equipo
  };
};

/**
 * Árbitro define quién saca primero en un set con sorteo manual (p. ej. set decisivo).
 */
export const ejecutarDefinirEquipoQueSacaSet = async (partidoId, userId, equipo) => {
  if (!partidoId) {
    return { status: 400, message: 'partido_id inválido' };
  }

  if (!EQUIPOS_SACA_VALIDOS.includes(equipo)) {
    return {
      status: 400,
      message: "equipo debe ser 'local' o 'visitante'",
    };
  }

  const partido = await Partidos.findByPk(partidoId, {
    attributes: ['id', 'arbitro_asignado_id', 'state', 'equipo_que_saca_inicial'],
  });

  if (!partido) {
    return { status: 404, message: 'Partido no encontrado' };
  }

  if (partido.arbitro_asignado_id !== userId) {
    return {
      status: 403,
      message: 'Solo el árbitro asignado puede definir quién saca',
    };
  }

  if (partido.state !== 'EN_CURSO') {
    return {
      status: 400,
      message: 'Solo se puede definir el saque de set durante un partido en curso',
    };
  }

  const marcador = await MarcadoresDetalle.findOne({
    where: { partido_id: partidoId },
  });

  if (!marcador) {
    return { status: 400, message: 'El partido no ha sido iniciado' };
  }

  if (marcador.resultado_principal !== 0) {
    return { status: 400, message: 'El partido ya finalizó' };
  }

  const pendienteAlineacion = marcador.metrica_estructura?.pendiente_alineacion_set;
  if (pendienteAlineacion) {
    return {
      status: 400,
      message: `Debes confirmar las alineaciones del set ${pendienteAlineacion} antes de definir el saque`,
    };
  }

  const pendiente = marcador.metrica_estructura?.pendiente_saque_set;
  if (!pendiente) {
    return {
      status: 400,
      message: 'No hay sorteo de saque pendiente para este set',
    };
  }

  const historial = [...(marcador.metrica_estructura?.saque_primero_por_set ?? [])];
  const yaDefinido = historial.some((e) => e.set_numero === pendiente);
  if (yaDefinido) {
    return {
      status: 400,
      message: `El saque del set ${pendiente} ya fue definido`,
    };
  }

  historial.push({ set_numero: pendiente, equipo });
  historial.sort((a, b) => a.set_numero - b.set_numero);

  await marcador.update({
    equipo_que_saca: equipo,
    metrica_estructura: {
      ...(marcador.metrica_estructura ?? {}),
      saque_primero_por_set: historial,
      pendiente_saque_set: null,
    },
    actualizado_en: new Date(),
  });

  await marcador.reload();

  await notificarMarcadorEnVivo(partidoId, { marcador, partido });

  return {
    status: 200,
    marcador: marcador.toJSON(),
    set_numero: pendiente,
    equipo_que_saca: equipo,
  };
};

/**
 * Lógica de inicio de partido (reutilizable fuera del handler HTTP).
 */
export const ejecutarInicioPartido = async (partidoId, userId) => {
  if (!partidoId) {
    return { status: 400, message: 'partido_id inválido' };
  }

  const partido = await Partidos.findByPk(partidoId, {
    attributes: [
      'id',
      'torneo_id',
      'arbitro_asignado_id',
      'state',
      'alineacion_local',
      'alineacion_visitante',
      'equipo_que_saca_inicial'
    ]
  });

  if (!partido) {
    return { status: 404, message: 'Partido no encontrado' };
  }

  if (partido.arbitro_asignado_id == null) {
    return {
      status: 400,
      message: 'Este partido no tiene árbitro asignado. Pide al organizador del torneo que asigne uno primero.'
    };
  }

  if (partido.arbitro_asignado_id !== userId) {
    return {
      status: 403,
      message: 'Solo el árbitro asignado puede iniciar el partido'
    };
  }

  const nominasPendientes = await PartidoNominas.count({
    where: {
      partido_id: partidoId,
      estado_validacion: 'PENDIENTE'
    }
  });

  if (nominasPendientes > 0) {
    return {
      status: 400,
      message: 'Hay jugadores en la nómina sin validar'
    };
  }

  if (!partido.equipo_que_saca_inicial) {
    return {
      status: 400,
      message: 'Debes indicar qué equipo saca primero antes de iniciar el partido'
    };
  }

  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partidoId },
    attributes: ['team_id']
  });

  const teamIds = [...new Set(
    participantes.map((p) => p.team_id).filter((id) => id != null)
  )];

  if (teamIds.length >= 2) {
    for (const teamId of teamIds) {
      const totalNominas = await PartidoNominas.count({
        where: { partido_id: partidoId, team_id: teamId, set_numero: 1 },
      });

      if (totalNominas === 0) {
        return {
          status: 400,
          message: 'Ambas alineaciones del set 1 deben estar confirmadas antes de iniciar el partido',
        };
      }

      const nominasValidadas = await PartidoNominas.count({
        where: {
          partido_id: partidoId,
          team_id: teamId,
          set_numero: 1,
          estado_validacion: 'VALIDADO',
        },
      });

      if (nominasValidadas !== totalNominas) {
        return {
          status: 400,
          message: 'Ambas alineaciones del set 1 deben estar confirmadas antes de iniciar el partido',
        };
      }
    }
  }

  const marcadorExistente = await MarcadoresDetalle.findOne({
    where: { partido_id: partidoId },
    attributes: ['id']
  });

  if (marcadorExistente) {
    return {
      status: 400,
      message: 'Este partido ya fue iniciado'
    };
  }

  let reglasSnapshot = { ...REGLAS_ARBITRAJE_DEFAULT };

  if (partido.torneo_id != null) {
    const torneo = await Torneos.findByPk(partido.torneo_id, {
      attributes: ['id', 'reglas_arbitraje_json']
    });

    if (torneo) {
      reglasSnapshot = resolverReglasArbitrajeSnapshot(torneo.reglas_arbitraje_json);
    }
  }

  const posicionesIniciales = {
    equipo_local: partido.alineacion_local ?? null,
    equipo_visitante: partido.alineacion_visitante ?? null,
  };
  const equipoQueSaca = partido.equipo_que_saca_inicial;
  const alineacionesPorSet = await cargarAlineacionesPorSet(partidoId);

  const marcador = await MarcadoresDetalle.create({
    partido_id: partidoId,
    reglas_arbitraje_snapshot: reglasSnapshot,
    posiciones_actuales: posicionesIniciales,
    equipo_que_saca: equipoQueSaca,
    metrica_estructura: {
      saque_primero_por_set: [{ set_numero: 1, equipo: equipoQueSaca }],
      pendiente_saque_set: null,
      pendiente_alineacion_set: null,
      alineaciones_por_set: alineacionesPorSet,
    },
  });

  await partido.update({ state: 'EN_CURSO' });

  await notificarMarcadorEnVivo(partidoId, { marcador, partido });

  return {
    status: 200,
    marcador: marcador.toJSON()
  };
};

const includePartidoConArbitro = [
  {
    model: User,
    as: 'arbitro',
    attributes: ['id', 'name', 'nick', 'photo']
  }
];

/**
 * PUT /api/partidos/:partido_id/arbitro
 */
export const asignarArbitroPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.partido_id);
    if (!partidoId) {
      return res.status(400).json({
        success: false,
        message: 'partido_id inválido'
      });
    }

    const partido = await Partidos.findByPk(partidoId, {
      attributes: ['id', 'torneo_id', 'arbitro_asignado_id']
    });

    if (!partido) {
      return res.status(404).json({
        success: false,
        message: 'Partido no encontrado'
      });
    }

    if (partido.torneo_id == null) {
      return res.status(400).json({
        success: false,
        message: 'Este partido no pertenece a un torneo, no requiere árbitro asignado'
      });
    }

    const torneo = await Torneos.findByPk(partido.torneo_id, {
      attributes: ['id', 'creado_por_user_id']
    });

    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el creador del torneo puede realizar esta acción'
      });
    }

    const arbitroId = parseId(req.body?.arbitro_asignado_id);
    if (!arbitroId) {
      return res.status(400).json({
        success: false,
        message: 'arbitro_asignado_id es obligatorio y debe ser un número válido'
      });
    }

    const arbitro = await User.findByPk(arbitroId, { attributes: ['id'] });
    if (!arbitro) {
      return res.status(404).json({
        success: false,
        message: 'Usuario árbitro no encontrado'
      });
    }

    const enCuerpo = await usuarioEnCuerpoArbitral(partido.torneo_id, arbitroId);
    if (!enCuerpo) {
      return res.status(400).json({
        success: false,
        message: 'El árbitro debe pertenecer al cuerpo arbitral confirmado del torneo. Invítalo y espera su aceptación desde Gestión → Gestionar árbitros.'
      });
    }

    await partido.update({
      arbitro_asignado_id: arbitroId,
      arbitro_confirmacion_estado: 'PENDIENTE',
    });

    const torneoConNombre = await Torneos.findByPk(partido.torneo_id, {
      attributes: ['id', 'nombre'],
    });

    await notificarAsignacionArbitro({
      partidoId,
      arbitroId,
      torneo: torneoConNombre,
    });

    const partidoActualizado = await Partidos.findByPk(partidoId, {
      include: includePartidoConArbitro
    });

    return res.status(200).json({
      success: true,
      message: 'Árbitro asignado al partido',
      data: partidoActualizado.toJSON()
    });
  } catch (error) {
    console.error('Error en asignarArbitroPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al asignar árbitro al partido',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/partidos/:partido_id/asignacion-arbitro
 */
export const getAsignacionArbitroDetalle = async (req, res) => {
  try {
    const partidoId = parseId(req.params.partido_id);
    if (!partidoId) {
      return res.status(400).json({
        success: false,
        message: 'partido_id inválido',
      });
    }

    const resultado = await obtenerDetalleAsignacionArbitro(partidoId, req.userId);

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: resultado.data,
    });
  } catch (error) {
    console.error('Error en getAsignacionArbitroDetalle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener asignación de arbitraje',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/partidos/:partido_id/arbitro/confirmar
 */
export const confirmarAsignacionArbitro = async (req, res) => {
  try {
    const partidoId = parseId(req.params.partido_id);
    const { respuesta } = req.body;

    if (!partidoId) {
      return res.status(400).json({
        success: false,
        message: 'partido_id inválido',
      });
    }

    const resultado = await responderConfirmacionArbitro(partidoId, req.userId, respuesta);

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.message,
      });
    }

    const { arbitro, torneo, equipo_local, equipo_visitante } = resultado.data;

    if (torneo?.creado_por_user_id) {
      await notificarRespuestaAsignacionArbitro({
        organizadorId: torneo.creado_por_user_id,
        arbitro,
        partidoId,
        nombreLocal: equipo_local,
        nombreVisitante: equipo_visitante,
        confirmado: respuesta === 'CONFIRMADO',
      });
    }

    return res.status(200).json({
      success: true,
      message: respuesta === 'CONFIRMADO'
        ? 'Arbitraje confirmado'
        : 'Asignación rechazada',
      data: {
        partido_id: partidoId,
        arbitro_confirmacion_estado: resultado.data.arbitro_confirmacion_estado,
      },
    });
  } catch (error) {
    console.error('Error en confirmarAsignacionArbitro:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al confirmar asignación de arbitraje',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const atributosPartidoMarcador = [
  'id',
  'name',
  'torneo_id',
  'fase_torneo_id',
  'grupo_division_id',
  'sport_id',
  'state',
  'datetime',
  'nivel_arbitraje',
  'arbitro_asignado_id',
  'score_local_final',
  'score_visitante_final'
];

/**
 * GET /api/partidos/:id/marcador
 */
export const getMarcadorPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    if (!partidoId) {
      return res.status(400).json({
        success: false,
        message: 'partido_id inválido'
      });
    }

    const detalle = await obtenerDetalleMarcadorPartido(partidoId);

    if (!detalle) {
      return res.status(404).json({
        success: false,
        message: 'Partido no encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      ...detalle,
    });
  } catch (error) {
    console.error('Error en getMarcadorPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener marcador del partido',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/partidos/:id/mapas-calor?jugador_id=&team_id=
 */
export const getMapasCalorPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const jugadorId = parseId(req.query.jugador_id);
    const teamId = parseId(req.query.team_id);
    const setNumero = req.query.set_numero != null ? parseId(req.query.set_numero) : null;

    if (!partidoId) {
      return res.status(400).json({ success: false, message: 'partido_id inválido' });
    }

    const resultado = await obtenerMapasCalorPartido(partidoId, { jugadorId, teamId, setNumero });

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.message,
      });
    }

    const { status, message, ...payload } = resultado;
    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error('Error en getMapasCalorPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al calcular mapas de calor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const serializarPartidoArbitraje = (partido) => {
  const participantes = partido.participantes ?? [];
  const local = participantes.find((p) => p.es_local === true);
  const visitante = participantes.find((p) => p.es_local === false);

  return {
    id: partido.id,
    torneo_id: partido.torneo_id,
    fase_torneo_id: partido.fase_torneo_id,
    grupo_division_id: partido.grupo_division_id,
    state: partido.state,
    datetime: partido.datetime,
    nivel_arbitraje: partido.nivel_arbitraje,
    arbitro_asignado_id: partido.arbitro_asignado_id,
    equipo_local_id: local?.team_id ?? null,
    equipo_local_nombre: local?.equipo?.name ?? null,
    equipo_visitante_id: visitante?.team_id ?? null,
    equipo_visitante_nombre: visitante?.equipo?.name ?? null
  };
};

/**
 * GET /api/partidos/mis-arbitrajes
 */
export const getMisArbitrajes = async (req, res) => {
  try {
    const partidos = await Partidos.findAll({
      where: { arbitro_asignado_id: req.userId },
      attributes: [
        'id',
        'torneo_id',
        'fase_torneo_id',
        'grupo_division_id',
        'state',
        'datetime',
        'nivel_arbitraje',
        'arbitro_asignado_id'
      ],
      include: [
        {
          model: PartidoParticipantes,
          as: 'participantes',
          attributes: ['team_id', 'es_local'],
          include: [
            {
              model: Team,
              as: 'equipo',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [[sequelize.literal('datetime ASC NULLS LAST')], ['id', 'ASC']]
    });

    return res.status(200).json({
      success: true,
      total: partidos.length,
      data: partidos.map((partido) => serializarPartidoArbitraje(partido.toJSON()))
    });
  } catch (error) {
    console.error('Error en getMisArbitrajes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener partidos asignados al árbitro',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/partidos/:id/equipo-que-saca-inicial
 * Body: { equipo: 'local' | 'visitante' }
 */
export const definirEquipoQueSacaInicial = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const equipo = req.body?.equipo;
    const resultado = await ejecutarDefinirEquipoQueSacaInicial(partidoId, req.userId, equipo);

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.message
      });
    }

    return res.status(200).json({
      success: true,
      equipo_que_saca_inicial: resultado.equipo_que_saca_inicial
    });
  } catch (error) {
    console.error('Error en definirEquipoQueSacaInicial:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al definir el equipo que saca primero',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/partidos/:id/equipo-que-saca-set
 * Body: { equipo: 'local' | 'visitante' } — sorteo manual del set decisivo (o set pendiente).
 */
export const definirEquipoQueSacaSet = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const equipo = req.body?.equipo;
    const resultado = await ejecutarDefinirEquipoQueSacaSet(partidoId, req.userId, equipo);

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.message,
      });
    }

    return res.status(200).json({
      success: true,
      marcador: resultado.marcador,
      set_numero: resultado.set_numero,
      equipo_que_saca: resultado.equipo_que_saca,
    });
  } catch (error) {
    console.error('Error en definirEquipoQueSacaSet:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al definir quién saca en el set',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /api/partidos/:id/iniciar
 */
export const iniciarPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id);
    const resultado = await ejecutarInicioPartido(partidoId, req.userId);

    if (!resultado.marcador) {
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
    console.error('Error en iniciarPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al iniciar el partido',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
