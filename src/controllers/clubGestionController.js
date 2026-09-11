import {
  listarNovedadesUsuario,
  listarMiembrosClub,
  listarAnunciosClub,
  obtenerAnuncioClub,
  eliminarAnuncioClub,
  crearAnuncioClub,
  listarEventosDivision,
  crearEventoDivision,
  listarEntrenamientosClub,
  obtenerEventoDetalle,
  listarLugaresDivision,
  responderConfirmacionEvento,
  calcularResumenEntrenamientosClub,
  obtenerJugadoresDivision,
  obtenerDetalleDivision,
  agregarAtletaDivision,
  actualizarAtletaDivision,
  eliminarAtletaDivision,
  invitarAtletaDivision,
  obtenerInvitacionDivisionDetalle,
  responderInvitacionDivision,
  crearEquipoCompetenciaDivision,
  obtenerPlantillaEquipoDivision,
  asignarPlantillaEquipoDivision,
  registrarAsistenciaEvento,
  actualizarEventoEntrenamiento,
  finalizarEventoEntrenamiento,
  listarMetricasDeporte,
  guardarEvaluacionEvento,
  crearPracticaDivision,
  iniciarFogueoDesdeEvento,
  usuarioEsMiembroActivoClub,
  unirseClubPorCodigo,
  listarMembresiaSolicitudes,
  obtenerMembresiaSolicitudDetalle,
  responderMembresiaSolicitud,
} from '../services/clubGestionService.js';
import { parseId, usuarioPuedeGestionarClub } from '../services/clubsService.js';
import { Clubs } from '../db/db.js';
import {
  subirImagenPerfil,
  formatearErrorCloudinary,
} from '../services/cloudinaryService.js';

const parseEncuestaBody = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getNovedadesClubes = async (req, res) => {
  try {
    const data = await listarNovedadesUsuario(req.userId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error en getNovedadesClubes:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener novedades' });
  }
};

export const getMiembrosClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const [permisos, esMiembro] = await Promise.all([
      usuarioPuedeGestionarClub(clubId, req.userId),
      usuarioEsMiembroActivoClub(clubId, req.userId),
    ]);
    if (!permisos.puede && !esMiembro) {
      return res.status(403).json({ success: false, message: 'Sin permiso' });
    }
    const data = await listarMiembrosClub(clubId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error en getMiembrosClub:', error);
    return res.status(500).json({ success: false, message: 'Error al listar miembros' });
  }
};

export const postUnirsePorCodigo = async (req, res) => {
  try {
    const result = await unirseClubPorCodigo({
      codigo: req.body?.codigo,
      userId: req.userId,
      solicitante: req.user ?? { id: req.userId },
    });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    return res.status(result.status).json({
      success: true,
      already_member: Boolean(result.alreadyMember),
      already_pending: Boolean(result.alreadyPending),
      data: result.data,
    });
  } catch (error) {
    console.error('Error en postUnirsePorCodigo:', error);
    return res.status(500).json({ success: false, message: 'Error al solicitar unirse al club' });
  }
};

export const getMembresiaSolicitudes = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await listarMembresiaSolicitudes({
      clubId,
      userId: req.userId,
      estado: req.query?.estado,
    });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getMembresiaSolicitudes:', error);
    return res.status(500).json({ success: false, message: 'Error al listar solicitudes' });
  }
};

export const getMembresiaSolicitudDetalle = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const solicitudId = parseId(req.params.solicitud_id);
    const result = await obtenerMembresiaSolicitudDetalle({
      clubId,
      solicitudId,
      userId: req.userId,
    });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getMembresiaSolicitudDetalle:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener solicitud' });
  }
};

export const putResponderMembresiaSolicitud = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const solicitudId = parseId(req.params.solicitud_id);
    const result = await responderMembresiaSolicitud({
      clubId,
      solicitudId,
      userId: req.userId,
      respuesta: req.body?.respuesta,
      rolMembresia: req.body?.rol_membresia,
    });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en putResponderMembresiaSolicitud:', error);
    return res.status(500).json({ success: false, message: 'Error al responder solicitud' });
  }
};

export const getAnunciosClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const data = await listarAnunciosClub(clubId, { viewerUserId: req.userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error en getAnunciosClub:', error);
    return res.status(500).json({ success: false, message: 'Error al listar comunicados' });
  }
};

export const getAnuncioClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const anuncioId = parseId(req.params.anuncio_id);
    const result = await obtenerAnuncioClub(clubId, anuncioId, req.userId);
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getAnuncioClub:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener aviso' });
  }
};

export const deleteAnuncioClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const anuncioId = parseId(req.params.anuncio_id);
    const result = await eliminarAnuncioClub(clubId, anuncioId, req.userId);
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error en deleteAnuncioClub:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar aviso' });
  }
};

export const postAnuncioClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const titulo = req.body?.titulo?.trim();
    const texto = req.body?.texto?.trim();
    const importancia = req.body?.importancia?.toUpperCase() ?? 'NORMAL';
    const clubDivisionId = parseId(req.body?.club_division_id);
    const equipoId = parseId(req.body?.equipo_id);
    const encuesta = parseEncuestaBody(req.body?.encuesta);

    if (!titulo || !texto) {
      return res.status(400).json({ success: false, message: 'titulo y texto son obligatorios' });
    }

    let imagenUrl = null;
    let imagenWidth = null;
    let imagenHeight = null;

    if (req.file) {
      try {
        const upload = await subirImagenPerfil(req.file, 'clubes/anuncios');
        imagenUrl = upload.secure_url;
        imagenWidth = upload.width ?? null;
        imagenHeight = upload.height ?? null;
      } catch (uploadError) {
        console.error('Error subiendo imagen de aviso:', uploadError);
        return res.status(400).json({
          success: false,
          message: formatearErrorCloudinary(uploadError),
        });
      }
    }

    const result = await crearAnuncioClub({
      clubId,
      autorId: req.userId,
      titulo,
      texto,
      importancia,
      clubDivisionId,
      equipoId,
      encuesta,
      imagenUrl,
      imagenWidth,
      imagenHeight,
    });

    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }

    return res.status(201).json({ success: true, data: result.data.toJSON() });
  } catch (error) {
    console.error('Error en postAnuncioClub:', error);
    return res.status(500).json({ success: false, message: 'Error al publicar comunicado' });
  }
};

export const getEventosDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const result = await listarEventosDivision(clubId, divisionId);
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getEventosDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al listar eventos' });
  }
};

export const postEventoDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const tipo = (req.body?.tipo || 'ENTRENAMIENTO').toUpperCase();
    const titulo = req.body?.titulo?.trim() || null;
    const descripcion = req.body?.descripcion?.trim() || null;
    const fechaHora = req.body?.fecha_hora;
    const fechaHoraFin = req.body?.fecha_hora_fin || null;
    const lugar = req.body?.lugar?.trim() || null;
    const diasRecurrencia = Array.isArray(req.body?.dias_recurrencia)
      ? req.body.dias_recurrencia
      : null;
    const enfoqueSesion = req.body?.enfoque_sesion || null;
    const metricasAEvaluar = Array.isArray(req.body?.metricas_a_evaluar)
      ? req.body.metricas_a_evaluar
      : null;
    const cupoLimite = req.body?.cupo_limite != null ? parseId(req.body.cupo_limite) : null;
    const indumentariaSugerida = Array.isArray(req.body?.indumentaria_sugerida)
      ? req.body.indumentaria_sugerida
      : null;

    if (!fechaHora) {
      return res.status(400).json({ success: false, message: 'fecha_hora es obligatoria' });
    }
    if (!lugar) {
      return res.status(400).json({ success: false, message: 'lugar es obligatorio' });
    }

    const result = await crearEventoDivision({
      clubId,
      divisionId,
      userId: req.userId,
      tipo,
      titulo,
      descripcion,
      fechaHora,
      fechaHoraFin,
      lugar,
      diasRecurrencia,
      enfoqueSesion,
      metricasAEvaluar,
      cupoLimite,
      indumentariaSugerida,
    });

    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }

    return res.status(201).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postEventoDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al crear evento' });
  }
};

export const getEntrenamientosClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = req.query.division_id ? parseId(req.query.division_id) : null;
    const result = await listarEntrenamientosClub(clubId, { divisionId });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getEntrenamientosClub:', error);
    return res.status(500).json({ success: false, message: 'Error al listar entrenamientos' });
  }
};

export const getResumenEntrenamientosClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const result = await calcularResumenEntrenamientosClub(clubId);
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getResumenEntrenamientosClub:', error);
    return res.status(500).json({ success: false, message: 'Error al calcular resumen' });
  }
};

export const getEventoDetalle = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const eventoId = parseId(req.params.evento_id);
    const result = await obtenerEventoDetalle(clubId, eventoId, req.userId);
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getEventoDetalle:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener evento' });
  }
};

export const putEventoEntrenamiento = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const eventoId = parseId(req.params.evento_id);
    const result = await actualizarEventoEntrenamiento({
      clubId,
      eventoId,
      userId: req.userId,
      fechaHora: req.body?.fecha_hora,
      fechaHoraFin: req.body?.fecha_hora_fin,
      lugar: req.body?.lugar,
      descripcion: req.body?.descripcion,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en putEventoEntrenamiento:', error);
    return res.status(500).json({ success: false, message: 'Error al editar entrenamiento' });
  }
};

export const postFinalizarEventoEntrenamiento = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const eventoId = parseId(req.params.evento_id);
    const result = await finalizarEventoEntrenamiento({
      clubId,
      eventoId,
      userId: req.userId,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postFinalizarEventoEntrenamiento:', error);
    return res.status(500).json({ success: false, message: 'Error al finalizar entrenamiento' });
  }
};

export const getLugaresDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const result = await listarLugaresDivision(clubId, divisionId);
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getLugaresDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al listar lugares' });
  }
};

export const postConfirmacionEvento = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const eventoId = parseId(req.params.evento_id);
    const respuesta = req.body?.respuesta;

    const result = await responderConfirmacionEvento({
      clubId,
      eventoId,
      userId: req.userId,
      respuesta,
    });

    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postConfirmacionEvento:', error);
    return res.status(500).json({ success: false, message: 'Error al registrar confirmación' });
  }
};

export const getJugadoresDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const result = await obtenerJugadoresDivision(clubId, divisionId);
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getJugadoresDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al listar jugadores' });
  }
};

export const postAsistenciaEvento = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const eventoId = parseId(req.params.evento_id);
    const registros = Array.isArray(req.body?.registros) ? req.body.registros : [];

    const result = await registrarAsistenciaEvento({
      clubId,
      eventoId,
      userId: req.userId,
      registros,
    });

    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postAsistenciaEvento:', error);
    return res.status(500).json({ success: false, message: 'Error al registrar asistencia' });
  }
};

export const getMetricasClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const club = await Clubs.findByPk(clubId, { attributes: ['sport_id'] });
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club no encontrado' });
    }
    const data = await listarMetricasDeporte(club.sport_id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error en getMetricasClub:', error);
    return res.status(500).json({ success: false, message: 'Error al listar métricas' });
  }
};

export const postEvaluacionEvento = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const eventoId = parseId(req.params.evento_id);
    const usuarioId = parseId(req.body?.usuario_id);
    const notasGenerales = req.body?.notas_generales?.trim() || null;
    const detalles = Array.isArray(req.body?.detalles) ? req.body.detalles : [];

    if (!usuarioId) {
      return res.status(400).json({ success: false, message: 'usuario_id es obligatorio' });
    }

    const result = await guardarEvaluacionEvento({
      clubId,
      eventoId,
      evaluadorId: req.userId,
      usuarioId,
      notasGenerales,
      detalles,
    });

    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }

    return res.status(201).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postEvaluacionEvento:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar evaluación' });
  }
};

export const postPracticaDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const datetime = req.body?.datetime;
    const lugar = req.body?.lugar?.trim() || null;
    const bandoA = Array.isArray(req.body?.bando_a) ? req.body.bando_a : [];
    const bandoB = Array.isArray(req.body?.bando_b) ? req.body.bando_b : [];

    const result = await crearPracticaDivision({
      clubId,
      divisionId,
      userId: req.userId,
      datetime,
      lugar,
      bandoA,
      bandoB,
    });

    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }

    return res.status(201).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postPracticaDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al crear práctica' });
  }
};

export const postIniciarFogueoEvento = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const eventoId = parseId(req.params.evento_id);
    const bandoA = Array.isArray(req.body?.bando_a) ? req.body.bando_a : [];
    const bandoB = Array.isArray(req.body?.bando_b) ? req.body.bando_b : [];
    const equipoQueSaca = req.body?.equipo_que_saca || 'local';

    const setsRaw = parseInt(req.body?.sets_para_ganar ?? 2, 10);
    const setsParaGanar = [1, 2, 3].includes(setsRaw) ? setsRaw : 2;
    const puntosRaw = parseInt(req.body?.puntos_por_set ?? 25, 10);
    const puntosPorSet = Number.isFinite(puntosRaw) && puntosRaw >= 1 && puntosRaw <= 99
      ? puntosRaw
      : 25;

    const result = await iniciarFogueoDesdeEvento({
      clubId,
      eventoId,
      userId: req.userId,
      bandoA,
      bandoB,
      equipoQueSaca,
    });

    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }

    // Si ya está en curso, solo devolver. Si no, iniciar como árbitro (entrenador).
    if (result.data.ya_en_curso) {
      return res.status(200).json({ success: true, data: result.data });
    }

    const { ejecutarInicioPartido } = await import('./partidosController.js');
    const inicio = await ejecutarInicioPartido(result.data.partido_id, req.userId, {
      sets_para_ganar: setsParaGanar,
      puntos_por_set: puntosPorSet,
      ventaja_obligatoria: 2,
    });

    if (inicio.status !== 200) {
      return res.status(inicio.status ?? 400).json({
        success: false,
        message: inicio.message || 'Fogueo armado pero no se pudo iniciar el partido',
        data: result.data,
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        ...result.data,
        state: 'EN_CURSO',
        iniciado: true,
        sets_para_ganar: setsParaGanar,
        marcador: inicio.marcador ?? null,
      },
    });
  } catch (error) {
    console.error('Error en postIniciarFogueoEvento:', error);
    return res.status(500).json({ success: false, message: 'Error al iniciar fogueo' });
  }
};

export const getDetalleDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const result = await obtenerDetalleDivision(clubId, divisionId, req.userId);
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getDetalleDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener detalle de división' });
  }
};

export const postAtletaDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const result = await agregarAtletaDivision({
      clubId,
      divisionId,
      userId: req.userId,
      usuarioId: req.body?.usuario_id,
      dorsal: req.body?.dorsal,
      posicion: req.body?.posicion,
      estado: req.body?.estado,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(201).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postAtletaDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al agregar jugador a la nómina' });
  }
};

export const putAtletaDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const atletaId = parseId(req.params.atleta_id);
    const result = await actualizarAtletaDivision({
      clubId,
      divisionId,
      atletaId,
      userId: req.userId,
      updates: {
        dorsal: req.body?.dorsal,
        posicion: req.body?.posicion,
        estado: req.body?.estado,
      },
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en putAtletaDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar jugador' });
  }
};

export const deleteAtletaDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const atletaId = parseId(req.params.atleta_id);
    const result = await eliminarAtletaDivision({
      clubId,
      divisionId,
      atletaId,
      userId: req.userId,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, message: 'Jugador eliminado de la nómina' });
  } catch (error) {
    console.error('Error en deleteAtletaDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar jugador' });
  }
};

export const postInvitacionDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const result = await invitarAtletaDivision({
      clubId,
      divisionId,
      userId: req.userId,
      usuarioInvitadoId: req.body?.usuario_id,
      invitador: req.user,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(result.status ?? 201).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postInvitacionDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al enviar invitación' });
  }
};

export const getInvitacionDivisionDetalle = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const invitacionId = parseId(req.params.invitacion_id);
    const result = await obtenerInvitacionDivisionDetalle({
      clubId,
      divisionId,
      invitacionId,
      viewerId: req.userId,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getInvitacionDivisionDetalle:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener invitación' });
  }
};

export const putResponderInvitacionDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const invitacionId = parseId(req.params.invitacion_id);
    const result = await responderInvitacionDivision({
      clubId,
      divisionId,
      invitacionId,
      userId: req.userId,
      respuesta: req.body?.respuesta,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en putResponderInvitacionDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al responder invitación' });
  }
};

export const postEquipoCompetenciaDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const jugadorIds = Array.isArray(req.body?.jugador_ids) ? req.body.jugador_ids : [];
    const result = await crearEquipoCompetenciaDivision({
      clubId,
      divisionId,
      userId: req.userId,
      nombre: req.body?.nombre,
      jugadorIds,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(201).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en postEquipoCompetenciaDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al crear equipo de competencia' });
  }
};

export const getPlantillaEquipoDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const teamId = parseId(req.params.team_id);
    const result = await obtenerPlantillaEquipoDivision({
      clubId,
      divisionId,
      teamId,
      viewerId: req.userId,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en getPlantillaEquipoDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener plantilla' });
  }
};

export const putPlantillaEquipoDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const teamId = parseId(req.params.team_id);
    const jugadorIds = Array.isArray(req.body?.jugador_ids) ? req.body.jugador_ids : [];
    const result = await asignarPlantillaEquipoDivision({
      clubId,
      divisionId,
      teamId,
      userId: req.userId,
      jugadorIds,
    });
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, message: 'Plantilla actualizada' });
  } catch (error) {
    console.error('Error en putPlantillaEquipoDivision:', error);
    return res.status(500).json({ success: false, message: 'Error al actualizar plantilla' });
  }
};
