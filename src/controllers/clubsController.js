import { UniqueConstraintError } from 'sequelize';
import {
  Clubs,
  ClubDivisiones,
  ClubSolicitudes,
  Team,
  TeamMiembros,
  User,
  Sports,
  sequelize,
} from '../db/db.js';
import {
  buscarClub,
  parseId,
  usuarioEsAdminClub,
  usuarioPuedeGestionarClub,
  usuarioPuedeResponderSolicitud,
  validarDivisionPerteneceClub,
  validarEquipoParaClub,
  listarClubesUsuario,
  obtenerPerfilPublicoClub,
  serializarDivision,
} from '../services/clubsService.js';
import {
  notificarSolicitudClub,
  notificarClubAceptada,
  notificarClubRechazada,
} from '../services/notificacionesService.js';
import { scheduleSideEffect } from '../utils/scheduleSideEffect.js';
import {
  crearDivisionDefault,
  asegurarMiembroClub,
  obtenerDivisionDefault,
  sincronizarMiembrosEquipoAlClub,
  sincronizarEquipoANominaDivision,
  eliminarDivisionClub,
} from '../services/clubGestionService.js';

const RESPUESTAS_VALIDAS = ['ACEPTADA', 'RECHAZADA'];
const GENEROS_VALIDOS = ['MASCULINO', 'FEMENINO', 'MIXTO'];

const includeSolicitud = [
  {
    model: Team,
    as: 'equipo',
    attributes: ['id', 'name', 'logo_url', 'capitan_id', 'sport_id'],
    include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
  },
  {
    model: ClubDivisiones,
    as: 'division',
    attributes: ['id', 'nombre', 'genero', 'categoria_edad'],
    required: false,
  },
  {
    model: User,
    as: 'iniciadoPor',
    attributes: ['id', 'nick', 'name', 'photo'],
  },
];

export const createClub = async (req, res) => {
  try {
    const nombre = req.body?.nombre?.trim();
    const sportId = parseId(req.body?.sport_id);
    const descripcion = req.body?.descripcion?.trim() || null;
    const ubicacion = req.body?.ubicacion?.trim() || null;

    if (!nombre) {
      return res.status(400).json({ success: false, message: 'nombre es obligatorio' });
    }
    if (!sportId) {
      return res.status(400).json({ success: false, message: 'sport_id es obligatorio' });
    }

    const sport = await Sports.findByPk(sportId, { attributes: ['id'] });
    if (!sport) {
      return res.status(404).json({ success: false, message: 'Deporte no encontrado' });
    }

    const club = await sequelize.transaction(async (transaction) => {
      const creado = await Clubs.create({
        nombre,
        sport_id: sportId,
        admin_id: req.userId,
        descripcion,
        ubicacion,
      }, { transaction });

      await crearDivisionDefault(creado.id, { transaction });
      await asegurarMiembroClub({
        clubId: creado.id,
        usuarioId: req.userId,
        rolMembresia: 'ADMIN',
        transaction,
      });

      return creado;
    });

    const completo = await buscarClub(club.id);
    return res.status(201).json({
      success: true,
      message: 'Club creado',
      data: completo.toJSON(),
    });
  } catch (error) {
    console.error('Error en createClub:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear club',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getMisClubes = async (req, res) => {
  try {
    const data = await listarClubesUsuario(req.userId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error en getMisClubes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar clubes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getPerfilPublicoClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    if (!clubId) {
      return res.status(400).json({ success: false, message: 'club_id inválido' });
    }

    const perfil = await obtenerPerfilPublicoClub(clubId, req.userId);
    if (!perfil) {
      return res.status(404).json({ success: false, message: 'Club no encontrado' });
    }

    return res.status(200).json({ success: true, data: perfil });
  } catch (error) {
    console.error('Error en getPerfilPublicoClub:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfil del club',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const club = await Clubs.findByPk(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club no encontrado' });
    }
    if (!usuarioEsAdminClub(club, req.userId)) {
      return res.status(403).json({ success: false, message: 'Solo el administrador del club puede editarlo' });
    }

    const updates = {};
    if (req.body?.nombre != null) updates.nombre = String(req.body.nombre).trim();
    if (req.body?.descripcion != null) updates.descripcion = String(req.body.descripcion).trim() || null;
    if (req.body?.ubicacion != null) updates.ubicacion = String(req.body.ubicacion).trim() || null;

    await club.update(updates);
    const completo = await buscarClub(club.id);
    return res.status(200).json({ success: true, data: completo.toJSON() });
  } catch (error) {
    console.error('Error en updateClub:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar club',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const club = await Clubs.findByPk(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club no encontrado' });
    }
    if (!usuarioEsAdminClub(club, req.userId)) {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede crear divisiones' });
    }

    const nombre = req.body?.nombre?.trim();
    const categoriaEdad = req.body?.categoria_edad?.trim() || null;
    const encargadoId = parseId(req.body?.encargado_id);

    let genero = null;
    if (req.body?.genero != null && String(req.body.genero).trim() !== '') {
      genero = String(req.body.genero).toUpperCase();
      if (!GENEROS_VALIDOS.includes(genero)) {
        return res.status(400).json({ success: false, message: 'genero debe ser MASCULINO, FEMENINO o MIXTO' });
      }
    }

    if (!nombre) {
      return res.status(400).json({ success: false, message: 'nombre es obligatorio' });
    }

    if (encargadoId) {
      const encargado = await User.findByPk(encargadoId, { attributes: ['id'] });
      if (!encargado) {
        return res.status(404).json({ success: false, message: 'Encargado no encontrado' });
      }
    }

    const division = await ClubDivisiones.create({
      club_id: clubId,
      nombre,
      genero,
      categoria_edad: categoriaEdad,
      encargado_id: encargadoId,
    });

    const completa = await ClubDivisiones.findByPk(division.id, {
      include: [{ model: User, as: 'encargado', attributes: ['id', 'nick', 'name', 'photo'] }],
    });

    return res.status(201).json({
      success: true,
      message: 'División creada',
      data: serializarDivision(completa),
    });
  } catch (error) {
    console.error('Error en createDivision:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear división',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id'] });
    if (!club || !usuarioEsAdminClub(club, req.userId)) {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede editar divisiones' });
    }

    const division = await ClubDivisiones.findOne({ where: { id: divisionId, club_id: clubId } });
    if (!division) {
      return res.status(404).json({ success: false, message: 'División no encontrada' });
    }

    const updates = {};
    if (req.body?.nombre != null) updates.nombre = String(req.body.nombre).trim();
    if (req.body?.genero !== undefined) {
      if (req.body.genero == null || String(req.body.genero).trim() === '') {
        updates.genero = null;
      } else {
        const genero = String(req.body.genero).toUpperCase();
        if (!GENEROS_VALIDOS.includes(genero)) {
          return res.status(400).json({ success: false, message: 'genero inválido' });
        }
        updates.genero = genero;
      }
    }
    if (req.body?.categoria_edad !== undefined) {
      updates.categoria_edad = req.body.categoria_edad?.trim() || null;
    }
    if (req.body?.encargado_id !== undefined) {
      const encargadoId = parseId(req.body.encargado_id);
      if (encargadoId) {
        const encargado = await User.findByPk(encargadoId, { attributes: ['id'] });
        if (!encargado) {
          return res.status(404).json({ success: false, message: 'Encargado no encontrado' });
        }
      }
      updates.encargado_id = encargadoId;
    }

    await division.update(updates);
    const completa = await ClubDivisiones.findByPk(division.id, {
      include: [{ model: User, as: 'encargado', attributes: ['id', 'nick', 'name', 'photo'] }],
    });

    return res.status(200).json({ success: true, data: serializarDivision(completa) });
  } catch (error) {
    console.error('Error en updateDivision:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar división',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteDivision = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const divisionId = parseId(req.params.division_id);
    const result = await eliminarDivisionClub(clubId, divisionId, req.userId);
    if (!result.ok) {
      return res.status(result.status ?? 400).json({ success: false, message: result.error });
    }
    return res.status(200).json({ success: true, message: 'División eliminada' });
  } catch (error) {
    console.error('Error en deleteDivision:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar división',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const solicitarUnionClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const teamId = parseId(req.body?.equipo_id);
    let divisionId = parseId(req.body?.club_division_id);

    if (!clubId || !teamId) {
      return res.status(400).json({ success: false, message: 'club_id y equipo_id son obligatorios' });
    }

    const club = await Clubs.findByPk(clubId, { attributes: ['id', 'nombre', 'sport_id', 'admin_id'] });
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club no encontrado' });
    }

    if (!divisionId) {
      const defaultDivision = await obtenerDivisionDefault(clubId);
      divisionId = defaultDivision.id;
    }

    const validacionEquipo = await validarEquipoParaClub(teamId, club);
    if (!validacionEquipo.ok) {
      return res.status(validacionEquipo.status).json({ success: false, message: validacionEquipo.error });
    }

    const { equipo } = validacionEquipo;
    if (equipo.capitan_id !== req.userId) {
      return res.status(403).json({ success: false, message: 'Solo el capitán puede solicitar unirse al club' });
    }

    const validacionDivision = await validarDivisionPerteneceClub(clubId, divisionId);
    if (!validacionDivision.ok) {
      return res.status(400).json({ success: false, message: validacionDivision.error });
    }

    const solicitud = await ClubSolicitudes.create({
      club_id: clubId,
      equipo_id: teamId,
      club_division_id: divisionId,
      iniciado_por_id: req.userId,
      estado: 'PENDIENTE',
    });

    const completa = await ClubSolicitudes.findByPk(solicitud.id, { include: includeSolicitud });

    scheduleSideEffect('solicitud-club', () => notificarSolicitudClub({
      solicitudId: solicitud.id,
      club,
      division: validacionDivision.division,
      equipo,
    }));

    return res.status(201).json({
      success: true,
      message: 'Solicitud enviada',
      data: completa.toJSON(),
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una solicitud activa para este equipo en este club',
      });
    }
    console.error('Error en solicitarUnionClub:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al solicitar unión al club',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listSolicitudesClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const permisos = await usuarioPuedeGestionarClub(clubId, req.userId);
    if (!permisos.puede) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver solicitudes de este club' });
    }

    const where = { club_id: clubId };
    const estado = req.query?.estado?.toUpperCase();
    if (estado) where.estado = estado;

    const solicitudes = await ClubSolicitudes.findAll({
      where,
      include: includeSolicitud,
      order: [['creado_at', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      total: solicitudes.length,
      data: solicitudes.map((s) => s.toJSON()),
    });
  } catch (error) {
    console.error('Error en listSolicitudesClub:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar solicitudes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getSolicitudClubDetalle = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const solicitudId = parseId(req.params.solicitud_id);

    const solicitud = await ClubSolicitudes.findOne({
      where: { id: solicitudId, club_id: clubId },
      include: [
        ...includeSolicitud,
        { model: Clubs, as: 'club', attributes: ['id', 'nombre', 'logo_url', 'admin_id'] },
      ],
    });

    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    const auth = await usuarioPuedeResponderSolicitud(
      clubId,
      solicitud.club_division_id,
      req.userId,
    );
    if (!auth.puede) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver esta solicitud' });
    }

    const jugadoresCount = await TeamMiembros.count({
      where: { team_id: solicitud.equipo_id, estado_invitacion: 'ACEPTADO' },
    });

    return res.status(200).json({
      success: true,
      data: {
        solicitud: {
          id: solicitud.id,
          estado: solicitud.estado,
          creado_at: solicitud.creado_at,
          club_division_id: solicitud.club_division_id,
        },
        club: solicitud.club,
        division: solicitud.division,
        equipo: solicitud.equipo,
        iniciado_por: solicitud.iniciadoPor,
        jugadores_count: jugadoresCount,
      },
    });
  } catch (error) {
    console.error('Error en getSolicitudClubDetalle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener solicitud',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const responderSolicitudClub = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    const solicitudId = parseId(req.params.solicitud_id);
    const { respuesta } = req.body;

    if (!RESPUESTAS_VALIDAS.includes(respuesta)) {
      return res.status(400).json({ success: false, message: 'respuesta debe ser ACEPTADA o RECHAZADA' });
    }

    const solicitud = await ClubSolicitudes.findOne({
      where: { id: solicitudId, club_id: clubId },
      include: [{ model: Team, as: 'equipo', attributes: ['id', 'name', 'capitan_id', 'sport_id', 'club_id'] }],
    });

    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }

    if (solicitud.estado !== 'PENDIENTE') {
      return res.status(400).json({ success: false, message: 'Esta solicitud ya fue respondida' });
    }

    const auth = await usuarioPuedeResponderSolicitud(
      clubId,
      solicitud.club_division_id,
      req.userId,
    );
    if (!auth.puede) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para responder esta solicitud' });
    }

    const club = await Clubs.findByPk(clubId, { attributes: ['id', 'nombre'] });
    const capitanId = solicitud.equipo?.capitan_id;

    await sequelize.transaction(async (transaction) => {
      await solicitud.update(
        {
          estado: respuesta,
          resuelto_por_id: req.userId,
          resuelto_at: new Date(),
        },
        { transaction },
      );

      if (respuesta === 'ACEPTADA') {
        let divisionId = solicitud.club_division_id;
        if (!divisionId) {
          const defaultDivision = await obtenerDivisionDefault(clubId, { transaction });
          divisionId = defaultDivision.id;
          await solicitud.update({ club_division_id: divisionId }, { transaction });
        }

        await Team.update(
          {
            club_id: clubId,
            club_division_id: divisionId,
            genero: null,
            categoria_edad: null,
          },
          { where: { id: solicitud.equipo_id }, transaction },
        );

        await sincronizarMiembrosEquipoAlClub({
          clubId,
          equipoId: solicitud.equipo_id,
          transaction,
        });

        await sincronizarEquipoANominaDivision({
          divisionId,
          equipoId: solicitud.equipo_id,
          transaction,
        });

        if (capitanId) {
          await asegurarMiembroClub({
            clubId,
            usuarioId: capitanId,
            rolMembresia: 'MIEMBRO',
            transaction,
          });
        }
      }
    });

    if (capitanId) {
      if (respuesta === 'ACEPTADA') {
        scheduleSideEffect('club-aceptada', () => notificarClubAceptada({
          solicitudId: solicitud.id,
          club,
          capitanId,
        }));
      } else {
        scheduleSideEffect('club-rechazada', () => notificarClubRechazada({
          solicitudId: solicitud.id,
          club,
          capitanId,
        }));
      }
    }

    const actualizada = await ClubSolicitudes.findByPk(solicitud.id, { include: includeSolicitud });
    return res.status(200).json({
      success: true,
      message: 'Solicitud respondida',
      data: actualizada.toJSON(),
    });
  } catch (error) {
    console.error('Error en responderSolicitudClub:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al responder solicitud',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateClubLogo = async (req, res) => {
  try {
    const clubId = parseId(req.params.club_id);
    if (!clubId) {
      return res.status(400).json({ success: false, message: 'club_id inválido' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'La imagen logo es obligatoria' });
    }

    const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id'] });
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club no encontrado' });
    }

    if (!usuarioEsAdminClub(club, req.userId)) {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede cambiar el logo' });
    }

    const { subirImagenPerfil, formatearErrorCloudinary } = await import('../services/cloudinaryService.js');
    const upload = await subirImagenPerfil(req.file, 'clubes');
    await club.update({ logo_url: upload.secure_url });

    const completo = await buscarClub(club.id);
    return res.status(200).json({
      success: true,
      message: 'Logo del club actualizado',
      data: completo.toJSON(),
    });
  } catch (error) {
    const { formatearErrorCloudinary } = await import('../services/cloudinaryService.js');
    console.error('Error en updateClubLogo:', error);
    return res.status(500).json({
      success: false,
      message: formatearErrorCloudinary(error) || 'Error al subir logo del club',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
