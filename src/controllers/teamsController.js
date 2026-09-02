import { UniqueConstraintError } from 'sequelize';
import {
  Team,
  TeamMiembros,
  DataTeam,
  Sports,
  User,
  sequelize
} from '../db/db.js';
import { obtenerEquiposDestacados } from '../services/destacadosService.js';
import { notificarInvitacionEquipo, notificarRespuestaInvitacionEquipo } from '../services/notificacionesService.js';
import {
  listarEquiposConfirmadosUsuario,
  listarEquiposCapitanPorDeporte,
  obtenerPerfilPublicoEquipo,
} from '../services/teamsService.js';

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const RESPUESTAS_VALIDAS = ['ACEPTADO', 'RECHAZADO'];

const includeMiembros = [
  {
    model: User,
    as: 'usuario',
    attributes: ['id', 'nick', 'name', 'photo']
  }
];

const includeTeamDetalle = [
  { model: Sports, as: 'sport', attributes: ['id', 'name'] },
  {
    model: TeamMiembros,
    as: 'miembros',
    include: includeMiembros
  },
  { model: DataTeam, as: 'estadisticas' },
  {
    model: User,
    as: 'capitan',
    attributes: ['id', 'nick', 'name', 'photo']
  }
];

const buscarEquipo = async (teamId) =>
  Team.findByPk(teamId, { attributes: ['id', 'capitan_id', 'name', 'sport_id'] });

const usuarioTieneAccesoEquipo = async (teamId, userId) => {
  const equipo = await buscarEquipo(teamId);
  if (!equipo) {
    return { equipo: null, tieneAcceso: false };
  }

  if (equipo.capitan_id === userId) {
    return { equipo, tieneAcceso: true };
  }

  const membresia = await TeamMiembros.findOne({
    where: { team_id: teamId, user_id: userId },
    attributes: ['id']
  });

  return { equipo, tieneAcceso: Boolean(membresia) };
};

const formatearEquipoDetalle = (equipo) => {
  const json = equipo.toJSON();
  json.miembros = (json.miembros ?? []).map((miembro) => ({
    id: miembro.id,
    user_id: miembro.user_id,
    rol: miembro.rol,
    position: miembro.position,
    estado_invitacion: miembro.estado_invitacion,
    fecha_union: miembro.fecha_union,
    dorsal_habitual: miembro.dorsal_habitual,
    usuario: miembro.usuario
  }));

  return json;
};

/**
 * GET /api/teams/mios?sport_id=X
 * Con sport_id: equipos confirmados del deporte activo (pestaña Juegos del perfil).
 * Sin sport_id: todas las membresías (MisEquipos, incluye invitaciones pendientes).
 */
export const getMisTeams = async (req, res) => {
  try {
    const sportId = req.query.sport_id ? parseId(req.query.sport_id) : null;
    const soloCapitan = String(req.query.rol ?? '').toUpperCase() === 'CAPITAN';

    if (soloCapitan) {
      const data = await listarEquiposCapitanPorDeporte(req.userId, sportId);
      return res.status(200).json({
        success: true,
        total: data.length,
        data,
      });
    }

    if (sportId) {
      const data = await listarEquiposConfirmadosUsuario(req.userId, sportId);
      return res.status(200).json({
        success: true,
        total: data.length,
        data,
      });
    }

    const membresias = await TeamMiembros.findAll({
      where: { user_id: req.userId },
      include: [
        {
          model: Team,
          as: 'equipo',
          include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
        },
      ],
      order: [['fecha_union', 'DESC']],
    });

    const data = membresias.map((membresia) => ({
      ...membresia.equipo.toJSON(),
      miembro_id: membresia.id,
      rol: membresia.rol,
      position: membresia.position,
      estado_invitacion: membresia.estado_invitacion,
      fecha_union: membresia.fecha_union,
    }));

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error('Error en getMisTeams:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener tus equipos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /api/teams
 */
export const createTeam = async (req, res) => {
  try {
    const { name, sport_id, privado } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'name es obligatorio'
      });
    }

    const sportId = parseId(sport_id);
    if (!sportId) {
      return res.status(400).json({
        success: false,
        message: 'sport_id es obligatorio y debe ser un número válido'
      });
    }

    const deporte = await Sports.findByPk(sportId, { attributes: ['id'] });
    if (!deporte) {
      return res.status(404).json({
        success: false,
        message: 'Deporte no encontrado'
      });
    }

    const equipo = await sequelize.transaction(async (transaction) => {
      const team = await Team.create(
        {
          name: name.trim(),
          sport_id: sportId,
          capitan_id: req.userId,
          privado: privado ?? false,
          creado_at: new Date()
        },
        { transaction }
      );

      await TeamMiembros.create(
        {
          team_id: team.id,
          user_id: req.userId,
          rol: 'CAPITAN',
          estado_invitacion: 'ACEPTADO',
          fecha_union: new Date()
        },
        { transaction }
      );

      await DataTeam.create(
        {
          team_id: team.id,
          elo: 0,
          games: 0,
          win: 0,
          lose: 0,
          draw: 0,
          total: 0
        },
        { transaction }
      );

      return team;
    });

    const equipoCompleto = await Team.findByPk(equipo.id, {
      include: includeTeamDetalle
    });

    return res.status(201).json({
      success: true,
      message: 'Equipo creado exitosamente',
      data: formatearEquipoDetalle(equipoCompleto)
    });
  } catch (error) {
    console.error('Error en createTeam:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear equipo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/teams/:team_id
 */
export const getTeamById = async (req, res) => {
  try {
    const teamId = parseId(req.params.team_id);
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'team_id inválido'
      });
    }

    const { equipo, tieneAcceso } = await usuarioTieneAccesoEquipo(teamId, req.userId);
    if (!equipo) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    if (!tieneAcceso) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este equipo'
      });
    }

    const equipoCompleto = await Team.findByPk(teamId, {
      include: includeTeamDetalle
    });

    return res.status(200).json({
      success: true,
      data: formatearEquipoDetalle(equipoCompleto)
    });
  } catch (error) {
    console.error('Error en getTeamById:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el equipo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/teams/:team_id/invitar
 */
export const invitarMiembroEquipo = async (req, res) => {
  try {
    const teamId = parseId(req.params.team_id);
    const userIdInvitado = parseId(req.body?.user_id);

    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'team_id inválido'
      });
    }

    if (!userIdInvitado) {
      return res.status(400).json({
        success: false,
        message: 'user_id es obligatorio y debe ser un número válido'
      });
    }

    if (userIdInvitado === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'No puedes invitarte a ti mismo al equipo'
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
        message: 'Solo el capitán del equipo puede invitar miembros'
      });
    }

    const usuarioInvitado = await User.findByPk(userIdInvitado, {
      attributes: ['id', 'nick', 'name']
    });

    if (!usuarioInvitado) {
      return res.status(404).json({
        success: false,
        message: 'Usuario invitado no encontrado'
      });
    }

    const membresiaExistente = await TeamMiembros.findOne({
      where: { team_id: teamId, user_id: userIdInvitado }
    });

    if (membresiaExistente?.estado_invitacion === 'ACEPTADO') {
      return res.status(409).json({
        success: false,
        message: 'Este usuario ya es miembro del equipo'
      });
    }

    let membresia = membresiaExistente;
    let reinvitacion = false;

    if (membresiaExistente) {
      reinvitacion = true;
      await membresiaExistente.update({
        estado_invitacion: 'PENDIENTE',
        rol: membresiaExistente.rol || 'JUGADOR',
        fecha_union: new Date(),
      });
      membresia = membresiaExistente;
    } else {
      membresia = await TeamMiembros.create({
        team_id: teamId,
        user_id: userIdInvitado,
        rol: 'JUGADOR',
        estado_invitacion: 'PENDIENTE',
        fecha_union: new Date()
      });
    }

    const membresiaCompleta = await TeamMiembros.findByPk(membresia.id, {
      include: includeMiembros
    });

    await notificarInvitacionEquipo({
      membresiaId: membresia.id,
      usuarioInvitadoId: userIdInvitado,
      capitan: req.user,
      equipo,
    });

    return res.status(reinvitacion ? 200 : 201).json({
      success: true,
      message: reinvitacion ? 'Invitación reenviada al equipo' : 'Invitación enviada al equipo',
      data: membresiaCompleta.toJSON()
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        success: false,
        message: 'Este usuario ya tiene una relación con el equipo'
      });
    }

    console.error('Error en invitarMiembroEquipo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al invitar miembro',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/teams/:team_id/miembros/:miembro_id/responder
 */
export const responderInvitacionEquipo = async (req, res) => {
  try {
    const teamId = parseId(req.params.team_id);
    const miembroId = parseId(req.params.miembro_id);
    const { respuesta } = req.body;

    if (!teamId || !miembroId) {
      return res.status(400).json({
        success: false,
        message: 'team_id o miembro_id inválido'
      });
    }

    if (!respuesta || !RESPUESTAS_VALIDAS.includes(respuesta)) {
      return res.status(400).json({
        success: false,
        message: 'respuesta debe ser ACEPTADO o RECHAZADO'
      });
    }

    const equipo = await buscarEquipo(teamId);
    if (!equipo) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    const membresia = await TeamMiembros.findOne({
      where: { id: miembroId, team_id: teamId },
      include: includeMiembros
    });

    if (!membresia) {
      return res.status(404).json({
        success: false,
        message: 'Miembro no encontrado en este equipo'
      });
    }

    if (membresia.user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el usuario invitado puede responder esta invitación'
      });
    }

    if (membresia.estado_invitacion !== 'PENDIENTE') {
      return res.status(400).json({
        success: false,
        message: 'Esta invitación ya fue respondida'
      });
    }

    await membresia.update({
      estado_invitacion: respuesta,
      fecha_union: respuesta === 'ACEPTADO' ? new Date() : membresia.fecha_union
    });

    if (equipo.capitan_id && equipo.capitan_id !== req.userId) {
      await notificarRespuestaInvitacionEquipo({
        capitanId: equipo.capitan_id,
        jugador: membresia.usuario ?? { id: req.userId },
        equipo,
        aceptado: respuesta === 'ACEPTADO',
        membresiaId: miembroId,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invitación respondida',
      data: membresia.toJSON()
    });
  } catch (error) {
    console.error('Error en responderInvitacionEquipo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al responder invitación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/teams/:team_id/perfil
 * Perfil público del equipo (jugadores aceptados, seguidores, publicaciones).
 */
export const getPerfilPublicoEquipo = async (req, res) => {
  try {
    const teamId = parseId(req.params.team_id);
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'team_id inválido',
      });
    }

    const data = await obtenerPerfilPublicoEquipo(teamId, req.userId);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado',
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error en getPerfilPublicoEquipo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil del equipo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/teams/destacados
 * Equipos públicos ordenados por seguidores.
 */
export const getTeamsDestacados = async (req, res) => {
  try {
    const limite = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    const data = await obtenerEquiposDestacados(limite);

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
    });
  } catch (error) {
    console.error('Error en getTeamsDestacados:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener equipos destacados',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
