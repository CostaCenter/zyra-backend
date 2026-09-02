import { UniqueConstraintError } from 'sequelize';
import {
  Torneos,
  TorneoInscripcion,
  Team,
  User,
  TeamMiembros,
  DataTeam,
  Sports,
} from '../db/db.js';
import {
  validarCupoDisponible,
  validarTorneoAceptaInscripciones
} from '../services/torneoInscripcionValidaciones.js';
import {
  notificarSolicitudInscripcion,
  notificarInscripcionAceptada,
  notificarInscripcionRechazada,
  notificarRespuestaInvitacionTorneo,
} from '../services/notificacionesService.js';

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const RESPUESTAS_VALIDAS = ['ACEPTADA', 'RECHAZADA'];

const includeInscripcion = [
  {
    model: Team,
    as: 'equipo',
    attributes: ['id', 'name', 'logo_url', 'capitan_id', 'sport_id'],
    include: [
      {
        model: User,
        as: 'capitan',
        attributes: ['id', 'name', 'nick', 'photo'],
      },
      {
        model: DataTeam,
        as: 'estadisticas',
        attributes: ['win', 'lose', 'draw', 'games'],
        required: false,
      },
      {
        model: Sports,
        as: 'sport',
        attributes: ['id', 'name'],
        required: false,
      },
    ],
  },
  { model: User, as: 'iniciadoPor', attributes: ['id', 'name', 'nick', 'photo'] },
  { model: User, as: 'resueltoPor', attributes: ['id', 'name', 'nick'] }
];

const buscarTorneoDetalle = async (torneoId) =>
  Torneos.findByPk(torneoId, {
    attributes: [
      'id',
      'nombre',
      'creado_por_user_id',
      'sport_id',
      'max_equipos',
      'estado',
      'photo',
      'imagen_portada_url',
    ],
    include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
  });

const buscarEquipo = async (teamId) =>
  Team.findByPk(teamId, { attributes: ['id', 'capitan_id', 'name', 'sport_id'] });

/**
 * POST /api/torneos/:torneo_id/inscripciones/solicitar
 */
export const solicitarInscripcion = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const teamId = parseId(req.body.team_id);

    if (!torneoId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id y team_id son obligatorios y deben ser válidos'
      });
    }

    const torneo = await buscarTorneoDetalle(torneoId);
    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    const equipo = await buscarEquipo(teamId);
    if (!equipo) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    if (equipo.capitan_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el capitán del equipo puede solicitar la inscripción'
      });
    }

    if (equipo.sport_id !== torneo.sport_id) {
      return res.status(400).json({
        success: false,
        message: 'El deporte del equipo no coincide con el del torneo'
      });
    }

    const torneoCerrado = validarTorneoAceptaInscripciones(torneo);
    if (torneoCerrado) {
      return res.status(torneoCerrado.status).json({
        success: false,
        message: torneoCerrado.message
      });
    }

    const cupoLleno = await validarCupoDisponible(torneo);
    if (cupoLleno) {
      return res.status(cupoLleno.status).json({
        success: false,
        message: cupoLleno.message
      });
    }

    const inscripcion = await TorneoInscripcion.create({
      torneo_id: torneoId,
      team_id: teamId,
      origen: 'SOLICITUD_EQUIPO',
      iniciado_por_id: req.userId,
      estado: 'PENDIENTE'
    });

    const inscripcionCompleta = await TorneoInscripcion.findByPk(inscripcion.id, {
      include: includeInscripcion
    });

    await notificarSolicitudInscripcion({
      inscripcionId: inscripcion.id,
      torneoId,
      equipo,
    });

    return res.status(201).json({
      success: true,
      message: 'Solicitud de inscripción creada',
      data: inscripcionCompleta.toJSON()
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una solicitud activa para este equipo en este torneo'
      });
    }

    console.error('Error en solicitarInscripcion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al solicitar inscripción',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/torneos/:torneo_id/inscripciones/invitar
 */
export const invitarInscripcion = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const teamId = parseId(req.body.team_id);

    if (!torneoId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id y team_id son obligatorios y deben ser válidos'
      });
    }

    const torneo = await buscarTorneoDetalle(torneoId);
    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el organizador del torneo puede invitar equipos'
      });
    }

    const equipo = await buscarEquipo(teamId);
    if (!equipo) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    if (equipo.sport_id !== torneo.sport_id) {
      return res.status(400).json({
        success: false,
        message: 'El deporte del equipo no coincide con el del torneo'
      });
    }

    const torneoCerrado = validarTorneoAceptaInscripciones(torneo);
    if (torneoCerrado) {
      return res.status(torneoCerrado.status).json({
        success: false,
        message: torneoCerrado.message
      });
    }

    const cupoLleno = await validarCupoDisponible(torneo);
    if (cupoLleno) {
      return res.status(cupoLleno.status).json({
        success: false,
        message: cupoLleno.message
      });
    }

    const inscripcion = await TorneoInscripcion.create({
      torneo_id: torneoId,
      team_id: teamId,
      origen: 'INVITACION_TORNEO',
      iniciado_por_id: req.userId,
      estado: 'PENDIENTE'
    });

    const inscripcionCompleta = await TorneoInscripcion.findByPk(inscripcion.id, {
      include: includeInscripcion
    });

    return res.status(201).json({
      success: true,
      message: 'Invitación de inscripción enviada',
      data: inscripcionCompleta.toJSON()
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una solicitud activa para este equipo en este torneo'
      });
    }

    console.error('Error en invitarInscripcion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al invitar equipo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/torneos/:torneo_id/inscripciones/:inscripcion_id/responder
 */
export const responderInscripcion = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const inscripcionId = parseId(req.params.inscripcion_id);
    const { respuesta } = req.body;

    if (!torneoId || !inscripcionId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id o inscripcion_id inválido'
      });
    }

    if (!respuesta || !RESPUESTAS_VALIDAS.includes(respuesta)) {
      return res.status(400).json({
        success: false,
        message: 'respuesta debe ser ACEPTADA o RECHAZADA'
      });
    }

    const torneo = await buscarTorneoDetalle(torneoId);
    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    const inscripcion = await TorneoInscripcion.findOne({
      where: { id: inscripcionId, torneo_id: torneoId },
      include: [{ model: Team, as: 'equipo', attributes: ['id', 'capitan_id', 'name'] }],
    });

    if (!inscripcion) {
      return res.status(404).json({
        success: false,
        message: 'Inscripción no encontrada en este torneo'
      });
    }

    if (inscripcion.estado !== 'PENDIENTE') {
      return res.status(400).json({
        success: false,
        message: 'Esta solicitud ya fue respondida'
      });
    }

    if (inscripcion.origen === 'SOLICITUD_EQUIPO') {
      if (torneo.creado_por_user_id !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo el organizador del torneo puede responder esta solicitud'
        });
      }
    } else if (inscripcion.origen === 'INVITACION_TORNEO') {
      if (inscripcion.equipo.capitan_id !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo el capitán del equipo invitado puede responder esta invitación'
        });
      }
    }

    if (respuesta === 'ACEPTADA') {
      const torneoCerrado = validarTorneoAceptaInscripciones(torneo);
      if (torneoCerrado) {
        return res.status(torneoCerrado.status).json({
          success: false,
          message: torneoCerrado.message
        });
      }

      const cupoLleno = await validarCupoDisponible(torneo);
      if (cupoLleno) {
        return res.status(cupoLleno.status).json({
          success: false,
          message: cupoLleno.message
        });
      }
    }

    await inscripcion.update({
      estado: respuesta,
      resuelto_por_id: req.userId,
      resuelto_at: new Date()
    });

    if (inscripcion.origen === 'SOLICITUD_EQUIPO' && inscripcion.equipo?.capitan_id) {
      if (respuesta === 'ACEPTADA') {
        await notificarInscripcionAceptada({
          inscripcionId: inscripcion.id,
          torneo,
          capitanId: inscripcion.equipo.capitan_id,
        });
      } else if (respuesta === 'RECHAZADA') {
        await notificarInscripcionRechazada({
          inscripcionId: inscripcion.id,
          torneo,
          capitanId: inscripcion.equipo.capitan_id,
        });
      }
    } else if (
      inscripcion.origen === 'INVITACION_TORNEO'
      && torneo.creado_por_user_id
    ) {
      await notificarRespuestaInvitacionTorneo({
        organizadorId: torneo.creado_por_user_id,
        equipo: inscripcion.equipo,
        torneo,
        aceptada: respuesta === 'ACEPTADA',
        inscripcionId: inscripcion.id,
      });
    }

    const inscripcionActualizada = await TorneoInscripcion.findByPk(inscripcion.id, {
      include: includeInscripcion
    });

    return res.status(200).json({
      success: true,
      message: 'Inscripción respondida',
      data: inscripcionActualizada.toJSON()
    });
  } catch (error) {
    console.error('Error en responderInscripcion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al responder inscripción',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/torneos/:torneo_id/inscripciones/:inscripcion_id
 */
export const getInscripcionDetalle = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const inscripcionId = parseId(req.params.inscripcion_id);

    if (!torneoId || !inscripcionId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id o inscripcion_id inválido',
      });
    }

    const torneo = await buscarTorneoDetalle(torneoId);
    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado',
      });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el organizador del torneo puede ver esta solicitud',
      });
    }

    const inscripcion = await TorneoInscripcion.findOne({
      where: { id: inscripcionId, torneo_id: torneoId },
      include: includeInscripcion,
    });

    if (!inscripcion) {
      return res.status(404).json({
        success: false,
        message: 'Inscripción no encontrada en este torneo',
      });
    }

    const equipoJson = inscripcion.equipo?.toJSON?.() ?? inscripcion.equipo ?? {};
    const stats = equipoJson.estadisticas ?? {};

    const [jugadoresCount, cuposUsados] = await Promise.all([
      TeamMiembros.count({
        where: {
          team_id: inscripcion.team_id,
          estado_invitacion: 'ACEPTADO',
        },
      }),
      TorneoInscripcion.count({
        where: { torneo_id: torneoId, estado: 'ACEPTADA' },
      }),
    ]);

    const maxEquipos = torneo.max_equipos ?? null;

    return res.status(200).json({
      success: true,
      data: {
        inscripcion: {
          id: inscripcion.id,
          estado: inscripcion.estado,
          origen: inscripcion.origen,
          creado_at: inscripcion.creado_at,
        },
        torneo: {
          id: torneo.id,
          nombre: torneo.nombre,
          photo: torneo.photo,
          imagen_portada_url: torneo.imagen_portada_url,
          max_equipos: maxEquipos,
          sport: torneo.sport ? { id: torneo.sport.id, name: torneo.sport.name } : null,
        },
        equipo: {
          id: equipoJson.id,
          name: equipoJson.name,
          logo_url: equipoJson.logo_url,
          capitan: equipoJson.capitan ?? null,
          sport: equipoJson.sport ?? null,
          jugadores_count: jugadoresCount,
          record: {
            win: stats.win ?? 0,
            lose: stats.lose ?? 0,
          },
        },
        cupos: {
          usados: cuposUsados,
          maximo: maxEquipos,
          disponibles: maxEquipos != null
            ? Math.max(maxEquipos - cuposUsados, 0)
            : null,
        },
      },
    });
  } catch (error) {
    console.error('Error en getInscripcionDetalle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener la solicitud de inscripción',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/torneos/:torneo_id/inscripciones
 */
export const listInscripcionesTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);

    if (!torneoId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id inválido'
      });
    }

    const torneo = await buscarTorneoDetalle(torneoId);
    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el organizador del torneo puede ver las inscripciones'
      });
    }

    const inscripciones = await TorneoInscripcion.findAll({
      where: { torneo_id: torneoId },
      include: includeInscripcion,
      order: [['creado_at', 'DESC']]
    });

    const data = inscripciones.map((inscripcion) => inscripcion.toJSON());

    return res.status(200).json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    console.error('Error en listInscripcionesTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener inscripciones',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
