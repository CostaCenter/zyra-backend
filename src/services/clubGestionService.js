import { Op } from 'sequelize';
import {
  sequelize,
  Clubs,
  ClubDivisiones,
  ClubMiembros,
  ClubMembresiaSolicitudes,
  Sports,
  ClubAnuncios,
  ClubEventos,
  ClubEventoAsistencias,
  ClubEventoConfirmaciones,
  ClubMetricaEvaluacion,
  ClubEventoEvaluacion,
  ClubEventoEvaluacionDetalle,
  ClubDivisionAtletas,
  ClubDivisionInvitaciones,
  Team,
  TeamMiembros,
  DataTeam,
  User,
  Partidos,
  PartidoParticipantes,
  PartidoNominas,
  PartidoJugadorStats,
  MarcadoresDetalle,
} from '../db/db.js';
import {
  parseId,
  usuarioEsAdminClub,
  usuarioPuedeGestionarClub,
  validarDivisionPerteneceClub,
  serializarDivision,
  serializarEquipoClub,
  obtenerPermisosPublicacionAviso,
} from './clubsService.js';
import { cargarAlineacionesPorSet } from './alineacionPorSetService.js';
import {
  notificarAnuncioClub,
  notificarInvitacionClubDivision,
  notificarRespuestaInvitacionClubDivision,
  notificarConvocatoriaEntrenamiento,
  notificarSolicitudMembresiaClub,
  notificarMembresiaClubAceptada,
  notificarMembresiaClubRechazada,
} from './notificacionesService.js';
import {
  crearEncuesta,
  enriquecerInteraccionesBatch,
} from './interaccionSocialService.js';

export { obtenerPermisosPublicacionAviso };

export const DIVISION_DEFAULT_NOMBRE = 'Plantel Principal';
export const GENEROS_VALIDOS = ['MASCULINO', 'FEMENINO', 'MIXTO'];
export const TIPOS_EVENTO = ['ENTRENAMIENTO', 'REUNION', 'EVENTO_SOCIAL', 'PRUEBA', 'CONVOCATORIA'];
export const ESTADOS_ATLETA = ['ACTIVO', 'LESIONADO', 'INACTIVO'];
export const ESTADOS_INVITACION_DIVISION = ['PENDIENTE', 'ACEPTADA', 'RECHAZADA'];
export const ESTADOS_ASISTENCIA = ['PRESENTE', 'AUSENTE', 'JUSTIFICADO'];
export const ROLES_STAFF_CLUB = ['ADMIN', 'ENCARGADO', 'ENTRENADOR', 'STAFF'];

/** Roles que el admin puede asignar al aceptar una solicitud por código. */
export const ROLES_ASIGNABLES_CODIGO = [
  'ATLETA',
  'SOCIO',
  'VOLUNTARIO',
  'PADRE_FAMILIA',
  'STAFF',
  'ENTRENADOR',
  'ENCARGADO',
  'MIEMBRO',
];

export const ROLES_MEMBRESIA_CLUB = [
  'ADMIN',
  ...ROLES_ASIGNABLES_CODIGO,
];
export const ENFOQUES_SESION = [
  'Técnico/Fundamentos',
  'Físico',
  'Táctico/Sistema de juego',
  'Fogueo/Amistoso interno',
];
export const METRICAS_ENTRENAMIENTO = [
  'Saque', 'Recepción', 'Ataque', 'Bloqueo', 'Defensa', 'Actitud',
];
export const INDUMENTARIA_OPCIONES = [
  'Manga corta', 'Manga larga', 'Short', 'Licra', 'Rodilleras', 'Tobilleras', 'Zapatillas indoor',
];
export const RESPUESTAS_CONFIRMACION = ['VOY', 'NO_VOY', 'SIN_RESPONDER'];
export const ENFOQUE_FOGUEO = 'Fogueo/Amistoso interno';
export const SEMANAS_RECURRENCIA = 4;

export const crearDivisionDefault = async (clubId, { transaction = null } = {}) => {
  const [division] = await ClubDivisiones.findOrCreate({
    where: { club_id: clubId, nombre: DIVISION_DEFAULT_NOMBRE },
    defaults: {
      club_id: clubId,
      nombre: DIVISION_DEFAULT_NOMBRE,
      genero: null,
      categoria_edad: null,
      encargado_id: null,
    },
    transaction,
  });
  return division;
};

export const obtenerDivisionDefault = async (clubId, { transaction = null } = {}) => {
  let division = await ClubDivisiones.findOne({
    where: { club_id: clubId, nombre: DIVISION_DEFAULT_NOMBRE },
    transaction,
  });
  if (!division) {
    division = await crearDivisionDefault(clubId, { transaction });
  }
  return division;
};

export const asegurarMiembroClub = async ({
  clubId,
  usuarioId,
  rolMembresia,
  transaction = null,
}) => {
  if (!usuarioId) return null;

  const [miembro] = await ClubMiembros.findOrCreate({
    where: { club_id: clubId, usuario_id: usuarioId },
    defaults: {
      club_id: clubId,
      usuario_id: usuarioId,
      rol_membresia: rolMembresia,
      estado: 'ACTIVO',
    },
    transaction,
  });

  if (miembro.estado !== 'ACTIVO' || miembro.rol_membresia !== rolMembresia) {
    await miembro.update({ estado: 'ACTIVO', rol_membresia: rolMembresia }, { transaction });
  }

  return miembro;
};

export const sincronizarMiembrosEquipoAlClub = async ({
  clubId,
  equipoId,
  transaction = null,
}) => {
  const miembrosEquipo = await TeamMiembros.findAll({
    where: { team_id: equipoId, estado_invitacion: 'ACEPTADO' },
    attributes: ['user_id'],
    transaction,
  });

  await Promise.all(
    miembrosEquipo.map((m) => asegurarMiembroClub({
      clubId,
      usuarioId: m.user_id,
      rolMembresia: 'MIEMBRO',
      transaction,
    })),
  );
};

export const usuarioEsEncargadoDivision = async (clubId, divisionId, userId) => {
  if (!divisionId) return false;
  const division = await ClubDivisiones.findOne({
    where: { id: divisionId, club_id: clubId, encargado_id: userId },
    attributes: ['id'],
  });
  return Boolean(division);
};

/** Miembro activo del club (miembros, plantel de equipo o nómina de división). */
export const usuarioEsMiembroActivoClub = async (clubId, userId) => {
  if (!clubId || !userId) return false;

  const miembroClub = await ClubMiembros.findOne({
    where: { club_id: clubId, usuario_id: userId, estado: 'ACTIVO' },
    attributes: ['id'],
  });
  if (miembroClub) return true;

  const miembroEquipo = await TeamMiembros.findOne({
    where: { user_id: userId, estado_invitacion: 'ACEPTADO' },
    include: [{
      model: Team,
      as: 'equipo',
      where: { club_id: clubId },
      attributes: ['id'],
      required: true,
    }],
    attributes: ['id'],
  });
  if (miembroEquipo) return true;

  const atletaDivision = await ClubDivisionAtletas.findOne({
    where: {
      usuario_id: userId,
      estado: { [Op.ne]: 'INACTIVO' },
    },
    include: [{
      model: ClubDivisiones,
      as: 'division',
      where: { club_id: clubId },
      attributes: ['id'],
      required: true,
    }],
    attributes: ['id'],
  });

  return Boolean(atletaDivision);
};

const MSG_AVISO_SOLO_PROPIA_DIVISION = 'Solo puedes publicar avisos para tu propia división';

const incluyeId = (lista, id) =>
  Array.isArray(lista) && lista.some((item) => Number(item) === Number(id));

export const puedePublicarAnuncio = async ({
  clubId,
  userId,
  clubDivisionId = null,
  equipoId = null,
}) => {
  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id'] });
  if (!club) return { ok: false, status: 404, error: 'Club no encontrado' };

  let divisionId = clubDivisionId;
  if (equipoId) {
    const equipo = await Team.findOne({
      where: { id: equipoId, club_id: clubId },
      attributes: ['id', 'club_division_id'],
    });
    if (!equipo) {
      return { ok: false, status: 400, error: 'Equipo no pertenece al club' };
    }
    divisionId = equipo.club_division_id ?? divisionId;
  }

  const perms = await obtenerPermisosPublicacionAviso(clubId, userId, club);

  if (!perms.puede_publicar) {
    return { ok: false, status: 403, error: MSG_AVISO_SOLO_PROPIA_DIVISION };
  }

  // Alcance club completo
  if (!divisionId && !equipoId) {
    if (perms.puede_club_completo) {
      return { ok: true, esAdmin: perms.rol === 'admin' };
    }
    return { ok: false, status: 403, error: MSG_AVISO_SOLO_PROPIA_DIVISION };
  }

  if (!divisionId) {
    return { ok: false, status: 403, error: MSG_AVISO_SOLO_PROPIA_DIVISION };
  }

  const divisionPermitida = perms.division_ids === null
    || incluyeId(perms.division_ids, divisionId);

  if (!divisionPermitida) {
    return { ok: false, status: 403, error: MSG_AVISO_SOLO_PROPIA_DIVISION };
  }

  if (equipoId) {
    const equipoPermitido = perms.equipo_division_ids === null
      || incluyeId(perms.equipo_division_ids, divisionId);
    if (!equipoPermitido) {
      return { ok: false, status: 403, error: MSG_AVISO_SOLO_PROPIA_DIVISION };
    }
  }

  return { ok: true, esAdmin: perms.rol === 'admin' };
};

export const validarAlcanceAnuncio = async ({
  clubId,
  clubDivisionId = null,
  equipoId = null,
}) => {
  if (equipoId) {
    const equipo = await Team.findOne({
      where: { id: equipoId, club_id: clubId },
      attributes: ['id', 'club_division_id'],
    });
    if (!equipo) {
      return { ok: false, status: 400, error: 'Equipo no pertenece al club' };
    }
    if (clubDivisionId && equipo.club_division_id !== clubDivisionId) {
      return { ok: false, status: 400, error: 'El equipo no pertenece a la división indicada' };
    }
    return { ok: true, clubDivisionId: equipo.club_division_id ?? clubDivisionId };
  }

  if (clubDivisionId) {
    const val = await validarDivisionPerteneceClub(clubId, clubDivisionId);
    if (!val.ok) return { ok: false, status: 400, error: val.error };
  }

  return { ok: true, clubDivisionId: clubDivisionId ?? null };
};

export const resolverDestinatariosAnuncio = async (anuncio) => {
  const { club_id: clubId, club_division_id: divisionId, equipo_id: equipoId } = anuncio;
  const usuarioIds = new Set();

  if (equipoId) {
    const miembrosEquipo = await TeamMiembros.findAll({
      where: { team_id: equipoId, estado_invitacion: 'ACEPTADO' },
      attributes: ['user_id'],
    });
    miembrosEquipo.forEach((m) => usuarioIds.add(m.user_id));
  } else if (divisionId) {
    // Solo nómina + equipos de ESA división (no todo ClubMiembros)
    const [atletas, equipos, division] = await Promise.all([
      ClubDivisionAtletas.findAll({
        where: {
          club_division_id: divisionId,
          estado: { [Op.ne]: 'INACTIVO' },
        },
        attributes: ['usuario_id'],
      }),
      Team.findAll({
        where: { club_id: clubId, club_division_id: divisionId },
        attributes: ['id'],
      }),
      ClubDivisiones.findByPk(divisionId, { attributes: ['encargado_id'] }),
    ]);

    atletas.forEach((a) => usuarioIds.add(a.usuario_id));
    if (division?.encargado_id) usuarioIds.add(division.encargado_id);

    if (equipos.length) {
      const teamIds = equipos.map((e) => e.id);
      const jugadores = await TeamMiembros.findAll({
        where: { team_id: { [Op.in]: teamIds }, estado_invitacion: 'ACEPTADO' },
        attributes: ['user_id'],
      });
      jugadores.forEach((j) => usuarioIds.add(j.user_id));
    }
  } else {
    const [miembrosClub, equipos, atletas] = await Promise.all([
      ClubMiembros.findAll({
        where: { club_id: clubId, estado: 'ACTIVO' },
        attributes: ['usuario_id'],
      }),
      Team.findAll({
        where: { club_id: clubId },
        attributes: ['id'],
      }),
      ClubDivisionAtletas.findAll({
        where: { estado: { [Op.ne]: 'INACTIVO' } },
        include: [{
          model: ClubDivisiones,
          as: 'division',
          where: { club_id: clubId },
          attributes: [],
          required: true,
        }],
        attributes: ['usuario_id'],
      }),
    ]);
    miembrosClub.forEach((m) => usuarioIds.add(m.usuario_id));
    atletas.forEach((a) => usuarioIds.add(a.usuario_id));
    if (equipos.length) {
      const teamIds = equipos.map((e) => e.id);
      const jugadores = await TeamMiembros.findAll({
        where: { team_id: { [Op.in]: teamIds }, estado_invitacion: 'ACEPTADO' },
        attributes: ['user_id'],
      });
      jugadores.forEach((j) => usuarioIds.add(j.user_id));
    }
  }

  // Gestores del club siempre reciben el aviso
  const [club, staff, encargados] = await Promise.all([
    Clubs.findByPk(clubId, { attributes: ['admin_id'] }),
    ClubMiembros.findAll({
      where: {
        club_id: clubId,
        estado: 'ACTIVO',
        rol_membresia: { [Op.in]: ['ADMIN', 'ENCARGADO', 'ENTRENADOR'] },
      },
      attributes: ['usuario_id'],
    }),
    ClubDivisiones.findAll({
      where: { club_id: clubId, encargado_id: { [Op.ne]: null } },
      attributes: ['encargado_id'],
    }),
  ]);
  if (club?.admin_id) usuarioIds.add(club.admin_id);
  staff.forEach((m) => usuarioIds.add(m.usuario_id));
  encargados.forEach((d) => {
    if (d.encargado_id) usuarioIds.add(d.encargado_id);
  });

  return [...usuarioIds];
};

/**
 * Contexto de visibilidad de avisos para un viewer.
 * Gestión (ve todo del club): admin, encargado de cualquier división, entrenador.
 * Miembro regular: solo alcance club / su división / su equipo.
 */
export const construirContextoVisibilidadAvisos = async (userId, { clubId = null } = {}) => {
  const clubFilter = clubId ? { club_id: clubId } : {};

  const [
    adminClubes,
    membresias,
    divisionesEncargadas,
    equiposMios,
    atletasNomina,
  ] = await Promise.all([
    Clubs.findAll({
      where: clubId ? { id: clubId, admin_id: userId } : { admin_id: userId },
      attributes: ['id'],
    }),
    ClubMiembros.findAll({
      where: { usuario_id: userId, estado: 'ACTIVO', ...clubFilter },
      attributes: ['club_id', 'rol_membresia'],
    }),
    ClubDivisiones.findAll({
      where: { encargado_id: userId, ...clubFilter },
      attributes: ['id', 'club_id'],
    }),
    TeamMiembros.findAll({
      where: { user_id: userId, estado_invitacion: 'ACEPTADO' },
      include: [{
        model: Team,
        as: 'equipo',
        attributes: ['id', 'club_id', 'club_division_id'],
        where: clubId ? { club_id: clubId } : undefined,
        required: true,
      }],
    }),
    ClubDivisionAtletas.findAll({
      where: {
        usuario_id: userId,
        estado: { [Op.ne]: 'INACTIVO' },
      },
      include: [{
        model: ClubDivisiones,
        as: 'division',
        attributes: ['id', 'club_id'],
        where: clubId ? { club_id: clubId } : undefined,
        required: true,
      }],
      attributes: ['club_division_id'],
    }),
  ]);

  const adminClubIds = new Set(adminClubes.map((c) => c.id));
  const gestionClubIds = new Set(adminClubIds);
  const miembroClubIds = new Set(adminClubIds);
  const divisionIds = new Set();
  const equipoIds = new Set();

  membresias.forEach((m) => {
    miembroClubIds.add(m.club_id);
    if (['ADMIN', 'ENCARGADO', 'ENTRENADOR'].includes(m.rol_membresia)) {
      gestionClubIds.add(m.club_id);
    }
  });

  divisionesEncargadas.forEach((d) => {
    gestionClubIds.add(d.club_id);
    miembroClubIds.add(d.club_id);
    divisionIds.add(d.id);
  });

  equiposMios.forEach((tm) => {
    const eq = tm.equipo;
    if (!eq) return;
    miembroClubIds.add(eq.club_id);
    equipoIds.add(eq.id);
    if (eq.club_division_id) divisionIds.add(eq.club_division_id);
  });

  atletasNomina.forEach((a) => {
    const div = a.division;
    if (!div) return;
    miembroClubIds.add(div.club_id);
    divisionIds.add(a.club_division_id || div.id);
  });

  return {
    adminClubIds,
    gestionClubIds,
    miembroClubIds,
    divisionIds,
    equipoIds,
  };
};

export const anuncioVisibleParaViewer = (anuncio, ctx) => {
  const clubId = anuncio.club_id;
  if (!clubId) return false;

  // Admin / encargado (cualquier división) / entrenador: ven todo el club
  if (ctx.gestionClubIds.has(clubId)) return true;

  if (anuncio.equipo_id) {
    return ctx.equipoIds.has(anuncio.equipo_id);
  }

  if (anuncio.club_division_id) {
    return ctx.divisionIds.has(anuncio.club_division_id);
  }

  // Alcance club completo
  return ctx.miembroClubIds.has(clubId);
};

export const listarMiembrosClub = async (clubId, { soloStaff = true } = {}) => {
  const where = { club_id: clubId, estado: 'ACTIVO' };
  if (soloStaff) {
    where.rol_membresia = { [Op.in]: ROLES_STAFF_CLUB };
  }

  const miembros = await ClubMiembros.findAll({
    where,
    include: [{
      model: User,
      as: 'usuario',
      attributes: ['id', 'nick', 'name', 'photo'],
    }],
    order: [['rol_membresia', 'ASC'], ['fecha_ingreso', 'ASC']],
  });

  return miembros.map((m) => {
    const json = m.toJSON();
    return {
      id: json.id,
      rol_membresia: json.rol_membresia,
      fecha_ingreso: json.fecha_ingreso,
      estado: json.estado,
      usuario: json.usuario,
    };
  });
};

export const crearAnuncioClub = async ({
  clubId,
  autorId,
  titulo,
  texto,
  importancia = 'NORMAL',
  clubDivisionId = null,
  equipoId = null,
  encuesta = null,
  imagenUrl = null,
  imagenWidth = null,
  imagenHeight = null,
}) => {
  const permiso = await puedePublicarAnuncio({
    clubId,
    userId: autorId,
    clubDivisionId,
    equipoId,
  });
  if (!permiso.ok) return permiso;

  const alcance = await validarAlcanceAnuncio({ clubId, clubDivisionId, equipoId });
  if (!alcance.ok) return alcance;

  const encuestaPayload = encuesta?.pregunta
    ? {
      pregunta: encuesta.pregunta,
      opciones: encuesta.opciones ?? [],
    }
    : null;

  const anuncio = await sequelize.transaction(async (transaction) => {
    const row = await ClubAnuncios.create({
      club_id: clubId,
      club_division_id: alcance.clubDivisionId ?? clubDivisionId ?? null,
      equipo_id: equipoId ?? null,
      autor_id: autorId,
      titulo,
      texto,
      importancia: importancia === 'IMPORTANTE' ? 'IMPORTANTE' : 'NORMAL',
      imagen_url: imagenUrl ?? null,
      imagen_width: imagenWidth ?? null,
      imagen_height: imagenHeight ?? null,
    }, { transaction });

    if (encuestaPayload) {
      const encResult = await crearEncuesta('AVISO', row.id, encuestaPayload, transaction);
      if (!encResult.ok) {
        throw new Error(encResult.error);
      }
    }

    return row;
  }).catch((error) => ({ ok: false, status: 400, error: error.message || 'Error al crear aviso' }));

  if (anuncio?.ok === false) return anuncio;

  const destinatarios = await resolverDestinatariosAnuncio(anuncio);
  await notificarAnuncioClub({
    anuncio,
    destinatarios: destinatarios.filter((id) => id !== autorId),
  });

  return { ok: true, data: anuncio };
};

export const listarAnunciosClub = async (clubId, { limit = 50, viewerUserId = null } = {}) => {
  const anuncios = await ClubAnuncios.findAll({
    where: { club_id: clubId },
    include: [
      { model: User, as: 'autor', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: ClubDivisiones, as: 'division', attributes: ['id', 'nombre', 'genero'], required: false },
      { model: Team, as: 'equipo', attributes: ['id', 'name'], required: false },
    ],
    order: [
      ['importancia', 'DESC'],
      ['creado_at', 'DESC'],
    ],
    limit: Math.max(limit * 4, 80),
  });

  let visibles = anuncios;
  if (viewerUserId) {
    const ctx = await construirContextoVisibilidadAvisos(viewerUserId, { clubId });
    visibles = anuncios.filter((a) => anuncioVisibleParaViewer(a, ctx));
  }
  visibles = visibles.slice(0, limit);

  const ids = visibles.map((a) => a.id);
  const interaccionesMap = await enriquecerInteraccionesBatch('AVISO', ids, viewerUserId);

  return visibles.map((a) => {
    const json = a.toJSON();
    const inter = interaccionesMap.get(a.id);
    return {
      ...json,
      stats: inter?.stats ?? { reacciones: 0, comentarios: 0 },
      interacciones: inter?.reacciones ?? null,
      encuesta: inter?.encuesta ?? null,
    };
  });
};

export const obtenerAnuncioClub = async (clubId, anuncioId, viewerUserId = null) => {
  const anuncio = await ClubAnuncios.findOne({
    where: { id: anuncioId, club_id: clubId },
    include: [
      { model: User, as: 'autor', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: ClubDivisiones, as: 'division', attributes: ['id', 'nombre', 'genero'], required: false },
      { model: Team, as: 'equipo', attributes: ['id', 'name'], required: false },
      { model: Clubs, as: 'club', attributes: ['id', 'nombre', 'logo_url', 'admin_id'] },
    ],
  });
  if (!anuncio) return { ok: false, status: 404, error: 'Aviso no encontrado' };

  if (viewerUserId) {
    const ctx = await construirContextoVisibilidadAvisos(viewerUserId, { clubId });
    if (!anuncioVisibleParaViewer(anuncio, ctx)) {
      return { ok: false, status: 403, error: 'No tienes acceso a este aviso' };
    }
  }

  const interaccionesMap = await enriquecerInteraccionesBatch('AVISO', [anuncio.id], viewerUserId);
  const inter = interaccionesMap.get(anuncio.id);
  const json = anuncio.toJSON();
  return {
    ok: true,
    data: {
      ...json,
      stats: inter?.stats ?? { reacciones: 0, comentarios: 0 },
      interacciones: inter?.reacciones ?? null,
      encuesta: inter?.encuesta ?? null,
      permisos: {
        puede_eliminar: Boolean(
          viewerUserId
          && (Number(anuncio.autor_id) === Number(viewerUserId)
            || Number(anuncio.club?.admin_id) === Number(viewerUserId)),
        ),
        puede_reportar: Boolean(
          viewerUserId && Number(anuncio.autor_id) !== Number(viewerUserId),
        ),
      },
    },
  };
};

export const eliminarAnuncioClub = async (clubId, anuncioId, userId) => {
  const anuncio = await ClubAnuncios.findOne({
    where: { id: anuncioId, club_id: clubId },
    attributes: ['id', 'autor_id', 'club_id'],
  });
  if (!anuncio) return { ok: false, status: 404, error: 'Aviso no encontrado' };

  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id'] });
  const esAutor = Number(anuncio.autor_id) === Number(userId);
  const esAdmin = usuarioEsAdminClub(club, userId);
  if (!esAutor && !esAdmin) {
    return { ok: false, status: 403, error: 'No puedes eliminar este aviso' };
  }

  const { ContenidoComentarios, ContenidoReacciones, Encuestas } = await import('../db/db.js');

  await sequelize.transaction(async (transaction) => {
    const comentarios = await ContenidoComentarios.findAll({
      where: { contenido_tipo: 'AVISO', contenido_id: anuncioId },
      attributes: ['id'],
      transaction,
    });
    const comentarioIds = comentarios.map((c) => c.id);
    if (comentarioIds.length) {
      await ContenidoReacciones.destroy({
        where: { contenido_tipo: 'COMENTARIO', contenido_id: { [Op.in]: comentarioIds } },
        transaction,
      });
    }
    await ContenidoComentarios.destroy({
      where: { contenido_tipo: 'AVISO', contenido_id: anuncioId },
      transaction,
    });
    await ContenidoReacciones.destroy({
      where: { contenido_tipo: 'AVISO', contenido_id: anuncioId },
      transaction,
    });
    await Encuestas.destroy({
      where: { contenido_tipo: 'AVISO', contenido_id: anuncioId },
      transaction,
    });
    await anuncio.destroy({ transaction });
  });

  return { ok: true };
};

export const listarNovedadesUsuario = async (userId, { limit = 30 } = {}) => {
  const ctx = await construirContextoVisibilidadAvisos(userId);
  const clubIds = [...ctx.miembroClubIds];
  if (!clubIds.length) return [];

  const anuncios = await ClubAnuncios.findAll({
    where: { club_id: { [Op.in]: clubIds } },
    include: [
      { model: Clubs, as: 'club', attributes: ['id', 'nombre', 'logo_url', 'admin_id'] },
      { model: User, as: 'autor', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: ClubDivisiones, as: 'division', attributes: ['id', 'nombre', 'genero'], required: false },
      { model: Team, as: 'equipo', attributes: ['id', 'name'], required: false },
    ],
    order: [
      ['importancia', 'DESC'],
      ['creado_at', 'DESC'],
    ],
    limit: Math.max(limit * 5, 60),
  });

  const visibles = anuncios
    .filter((a) => anuncioVisibleParaViewer(a, ctx))
    .slice(0, limit);

  const ids = visibles.map((a) => a.id);
  const autorIds = [...new Set(visibles.map((a) => a.autor_id).filter(Boolean))];
  const clubIdsVisibles = [...new Set(visibles.map((a) => a.club_id).filter(Boolean))];

  const [interaccionesMap, membresiasAutores] = await Promise.all([
    enriquecerInteraccionesBatch('AVISO', ids, userId),
    autorIds.length && clubIdsVisibles.length
      ? ClubMiembros.findAll({
        where: {
          club_id: { [Op.in]: clubIdsVisibles },
          usuario_id: { [Op.in]: autorIds },
          estado: 'ACTIVO',
        },
        attributes: ['club_id', 'usuario_id', 'rol_membresia'],
      })
      : Promise.resolve([]),
  ]);

  const rolPorClubAutor = new Map();
  for (const m of membresiasAutores) {
    rolPorClubAutor.set(`${m.club_id}:${m.usuario_id}`, m.rol_membresia);
  }

  const resolverAutorRol = (anuncio) => {
    const clubAdminId = anuncio.club?.admin_id ?? null;
    if (clubAdminId != null && Number(clubAdminId) === Number(anuncio.autor_id)) {
      return 'ADMIN';
    }
    return rolPorClubAutor.get(`${anuncio.club_id}:${anuncio.autor_id}`) ?? 'STAFF';
  };

  return visibles.map((a) => {
    const json = a.toJSON();
    const inter = interaccionesMap.get(a.id);
    return {
      ...json,
      autor_rol: resolverAutorRol(a),
      stats: inter?.stats ?? { reacciones: 0, comentarios: 0 },
      interacciones: inter?.reacciones ?? null,
      encuesta: inter?.encuesta ?? null,
    };
  });
};

export const puedeGestionarDivision = async (clubId, divisionId, userId) => {
  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id'] });
  if (!club) return false;
  if (usuarioEsAdminClub(club, userId)) return true;
  return usuarioEsEncargadoDivision(clubId, divisionId, userId);
};

const contarConfirmaciones = (confirmaciones = []) => ({
  confirmados: confirmaciones.filter((c) => c.respuesta === 'VOY').length,
  no_van: confirmaciones.filter((c) => c.respuesta === 'NO_VOY').length,
  sin_responder: confirmaciones.filter((c) => c.respuesta === 'SIN_RESPONDER').length,
});

export const serializarEvento = (evento, extras = {}) => {
  const json = typeof evento.toJSON === 'function' ? evento.toJSON() : evento;
  const confirmaciones = json.confirmaciones ?? extras.confirmaciones ?? [];
  const rsvp = contarConfirmaciones(confirmaciones);

  return {
    id: json.id,
    club_division_id: json.club_division_id,
    tipo: json.tipo,
    titulo: json.titulo,
    descripcion: json.descripcion ?? null,
    fecha_hora: json.fecha_hora,
    fecha_hora_fin: json.fecha_hora_fin ?? null,
    lugar: json.lugar ?? null,
    dias_recurrencia: json.dias_recurrencia ?? null,
    enfoque_sesion: json.enfoque_sesion ?? null,
    metricas_a_evaluar: json.metricas_a_evaluar ?? null,
    cupo_limite: json.cupo_limite ?? null,
    indumentaria_sugerida: json.indumentaria_sugerida ?? null,
    partido_id: json.partido_id ?? null,
    evento_serie_id: json.evento_serie_id ?? null,
    completado_at: json.completado_at ?? null,
    asistencia_real_pct: json.asistencia_real_pct ?? null,
    creado_por_id: json.creado_por_id,
    creado_at: json.creado_at,
    division: json.division
      ? {
        id: json.division.id,
        nombre: json.division.nombre,
        genero: json.division.genero ?? null,
        club_id: json.division.club_id,
      }
      : extras.division ?? null,
    rsvp,
    es_pasado: new Date(json.fecha_hora) < new Date(),
    completado: Boolean(json.completado_at),
    ...extras,
  };
};

const generarFechasRecurrencia = (fechaBase, diasRecurrencia, semanas = SEMANAS_RECURRENCIA) => {
  if (!Array.isArray(diasRecurrencia) || !diasRecurrencia.length) {
    return [fechaBase];
  }

  const diasSet = new Set(diasRecurrencia.map((d) => Number(d)));
  const inicioSemana = new Date(fechaBase);
  inicioSemana.setHours(fechaBase.getHours(), fechaBase.getMinutes(), 0, 0);
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());

  const fechas = [];
  for (let sem = 0; sem < semanas; sem += 1) {
    for (let dia = 0; dia < 7; dia += 1) {
      if (!diasSet.has(dia)) continue;
      const candidata = new Date(inicioSemana);
      candidata.setDate(inicioSemana.getDate() + (sem * 7) + dia);
      candidata.setHours(fechaBase.getHours(), fechaBase.getMinutes(), 0, 0);
      if (candidata >= fechaBase || sem > 0) {
        fechas.push(candidata);
      }
    }
  }

  if (!fechas.length) fechas.push(fechaBase);
  return fechas.sort((a, b) => a - b);
};

const crearPartidoPracticaInternaVacio = async ({
  clubId,
  divisionId,
  divisionNombre,
  userId,
  datetime,
  transaction,
}) => {
  const equipos = await Team.findAll({
    where: { club_id: clubId, club_division_id: divisionId },
    attributes: ['id', 'sport_id'],
    limit: 1,
    transaction,
  });
  if (!equipos.length) {
    throw new Error('La división no tiene equipos para anclar la práctica');
  }

  const equipoRef = equipos[0];
  const creado = await Partidos.create({
    name: `${divisionNombre} — fogueo interno`,
    torneo_id: null,
    fase_torneo_id: null,
    grupo_division_id: null,
    sport_id: equipoRef.sport_id,
    cancha_id: null,
    datetime: datetime ? new Date(datetime) : null,
    state: 'PROGRAMADO',
    tipo: 'AMISTOSO',
    nivel_arbitraje: 'BASICO',
    programado_por_id: userId,
    club_division_id: divisionId,
  }, { transaction });

  await PartidoParticipantes.create(
    { partido_id: creado.id, team_id: equipoRef.id, es_local: true },
    { transaction },
  );
  await PartidoParticipantes.create(
    { partido_id: creado.id, team_id: equipoRef.id, es_local: false },
    { transaction },
  );

  return creado;
};

const inicializarConfirmacionesEvento = async ({
  eventoId,
  usuarioIds,
  transaction,
}) => {
  await Promise.all(
    usuarioIds.map((usuarioId) => ClubEventoConfirmaciones.findOrCreate({
      where: { evento_id: eventoId, usuario_id: usuarioId },
      defaults: {
        evento_id: eventoId,
        usuario_id: usuarioId,
        respuesta: 'SIN_RESPONDER',
      },
      transaction,
    })),
  );
};

export const crearEventoDivision = async ({
  clubId,
  divisionId,
  userId,
  tipo = 'ENTRENAMIENTO',
  titulo,
  descripcion,
  fechaHora,
  fechaHoraFin = null,
  lugar,
  diasRecurrencia = null,
  enfoqueSesion = null,
  metricasAEvaluar = null,
  cupoLimite = null,
  indumentariaSugerida = null,
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const puede = await puedeGestionarDivision(clubId, divisionId, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para programar eventos en esta división' };

  const tipoEvento = (tipo || 'ENTRENAMIENTO').toUpperCase();
  if (!TIPOS_EVENTO.includes(tipoEvento)) {
    return { ok: false, status: 400, error: 'tipo de evento inválido' };
  }

  if (!fechaHora) {
    return { ok: false, status: 400, error: 'fecha_hora es obligatoria' };
  }

  const division = valDivision.division;
  const tituloFinal = titulo?.trim()
    || (enfoqueSesion ? `${enfoqueSesion} — ${division.nombre}` : `Entrenamiento — ${division.nombre}`);

  if (enfoqueSesion && !ENFOQUES_SESION.includes(enfoqueSesion)) {
    return { ok: false, status: 400, error: 'enfoque_sesion inválido' };
  }

  const metricas = Array.isArray(metricasAEvaluar)
    ? metricasAEvaluar.filter((m) => METRICAS_ENTRENAMIENTO.includes(m))
    : null;

  const indumentaria = Array.isArray(indumentariaSugerida)
    ? indumentariaSugerida.filter((i) => INDUMENTARIA_OPCIONES.includes(i))
    : null;

  const diasRec = Array.isArray(diasRecurrencia) && diasRecurrencia.length
    ? [...new Set(diasRecurrencia.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))]
    : null;

  const fechaBase = new Date(fechaHora);
  const fechas = generarFechasRecurrencia(fechaBase, diasRec);
  const duracionMs = fechaHoraFin
    ? new Date(fechaHoraFin).getTime() - fechaBase.getTime()
    : null;

  const jugadoresRes = await obtenerJugadoresDivision(clubId, divisionId);
  const jugadorIds = jugadoresRes.data.map((j) => j.usuario_id);

  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'nombre'] });

  const eventosCreados = await sequelize.transaction(async (transaction) => {
    let eventoPrincipal = null;
    const creados = [];

    for (let i = 0; i < fechas.length; i += 1) {
      const inicio = fechas[i];
      const fin = duracionMs != null ? new Date(inicio.getTime() + duracionMs) : null;

      let partidoId = null;
      if (enfoqueSesion === ENFOQUE_FOGUEO && i === 0) {
        const partido = await crearPartidoPracticaInternaVacio({
          clubId,
          divisionId,
          divisionNombre: division.nombre,
          userId,
          datetime: inicio,
          transaction,
        });
        partidoId = partido.id;
      }

      const evento = await ClubEventos.create({
        club_division_id: divisionId,
        tipo: tipoEvento,
        titulo: tituloFinal,
        descripcion: descripcion ?? null,
        fecha_hora: inicio,
        fecha_hora_fin: fin,
        lugar: lugar?.trim() || null,
        recurrente: false,
        dias_recurrencia: diasRec,
        enfoque_sesion: enfoqueSesion,
        metricas_a_evaluar: metricas?.length ? metricas : null,
        cupo_limite: cupoLimite ?? null,
        indumentaria_sugerida: indumentaria?.length ? indumentaria : null,
        partido_id: partidoId,
        evento_serie_id: eventoPrincipal?.id ?? null,
        creado_por_id: userId,
      }, { transaction });

      if (!eventoPrincipal) eventoPrincipal = evento;

      if (evento.id !== eventoPrincipal.id) {
        await evento.update({ evento_serie_id: eventoPrincipal.id }, { transaction });
      }

      await inicializarConfirmacionesEvento({
        eventoId: evento.id,
        usuarioIds: jugadorIds,
        transaction,
      });

      creados.push(evento);
    }

    return { eventoPrincipal, creados };
  });

  await Promise.all(
    eventosCreados.creados.map((evento) => notificarConvocatoriaEntrenamiento({
      eventoId: evento.id,
      club,
      division,
      evento,
      destinatarioIds: jugadorIds,
    })),
  );

  return {
    ok: true,
    data: serializarEvento(eventosCreados.eventoPrincipal, {
      division: { id: division.id, nombre: division.nombre, club_id: clubId },
      eventos_creados: eventosCreados.creados.length,
    }),
  };
};

export const listarEventosDivision = async (clubId, divisionId) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const eventos = await ClubEventos.findAll({
    where: { club_division_id: divisionId, tipo: 'ENTRENAMIENTO' },
    include: [
      { model: ClubDivisiones, as: 'division', attributes: ['id', 'nombre', 'genero', 'club_id'] },
      { model: ClubEventoConfirmaciones, as: 'confirmaciones', attributes: ['respuesta'] },
    ],
    order: [['fecha_hora', 'ASC']],
  });

  return { ok: true, data: eventos.map((e) => serializarEvento(e)) };
};

export const listarEntrenamientosClub = async (clubId, { divisionId = null } = {}) => {
  const divisiones = await ClubDivisiones.findAll({
    where: { club_id: clubId, ...(divisionId ? { id: divisionId } : {}) },
    attributes: ['id', 'nombre', 'genero', 'club_id'],
  });
  const divisionIds = divisiones.map((d) => d.id);
  if (!divisionIds.length) return { ok: true, data: [] };

  const eventos = await ClubEventos.findAll({
    where: {
      club_division_id: { [Op.in]: divisionIds },
      tipo: 'ENTRENAMIENTO',
    },
    include: [
      { model: ClubDivisiones, as: 'division', attributes: ['id', 'nombre', 'genero', 'club_id'] },
      { model: ClubEventoConfirmaciones, as: 'confirmaciones', attributes: ['respuesta'] },
    ],
    order: [['fecha_hora', 'DESC']],
  });

  return { ok: true, data: eventos.map((e) => serializarEvento(e)) };
};

export const obtenerEventoDetalle = async (clubId, eventoId, viewerId) => {
  const evento = await ClubEventos.findByPk(eventoId, {
    include: [
      { model: ClubDivisiones, as: 'division', attributes: ['id', 'nombre', 'genero', 'club_id'] },
      {
        model: ClubEventoConfirmaciones,
        as: 'confirmaciones',
        include: [{ model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] }],
      },
      { model: User, as: 'creadoPor', attributes: ['id', 'nick', 'name', 'photo'] },
    ],
  });

  if (!evento || evento.division?.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Evento no encontrado' };
  }

  const miConfirmacion = evento.confirmaciones?.find((c) => c.usuario_id === viewerId);
  const enDivision = await usuarioEstaEnNominaDivision(clubId, evento.club_division_id, viewerId);
  const puedeGestionar = await puedeGestionarDivision(clubId, evento.club_division_id, viewerId);

  const asistenciasRows = puedeGestionar
    ? await ClubEventoAsistencias.findAll({
      where: { evento_id: eventoId },
      attributes: ['usuario_id', 'estado'],
    })
    : [];

  const evaluacionesRows = puedeGestionar
    ? await ClubEventoEvaluacion.findAll({
      where: { evento_id: eventoId },
      attributes: ['id', 'usuario_id', 'notas_generales', 'creado_at'],
      include: [{
        model: ClubEventoEvaluacionDetalle,
        as: 'detalles',
        attributes: ['metrica_id', 'calificacion'],
        include: [{ model: ClubMetricaEvaluacion, as: 'metrica', attributes: ['id', 'nombre_metrica'] }],
      }],
    })
    : [];

  let fogueo = null;
  if (evento.partido_id) {
    const partido = await Partidos.findByPk(evento.partido_id, {
      attributes: [
        'id', 'name', 'state',
        'score_local_final', 'score_visitante_final',
        'datetime', 'finalizado_en',
      ],
    });
    if (partido) {
      const statsRows = partido.state === 'FINALIZADO'
        ? await PartidoJugadorStats.findAll({
          where: { partido_id: partido.id },
          attributes: [
            'user_id', 'team_id', 'goles', 'asistencias',
            'amarillas', 'rojas', 'puntos_personales',
          ],
          include: [{
            model: User,
            as: 'jugador',
            attributes: ['id', 'nick', 'name', 'photo'],
          }],
        })
        : [];

      const nominas = await PartidoNominas.findAll({
        where: { partido_id: partido.id, set_numero: 1 },
        attributes: ['user_id', 'es_local', 'dorsal'],
      });
      const bandoPorUser = new Map(
        nominas.map((n) => [n.user_id, n.es_local === true ? 'A' : 'B']),
      );

      fogueo = {
        partido_id: partido.id,
        name: partido.name,
        state: partido.state,
        score_local_final: partido.score_local_final,
        score_visitante_final: partido.score_visitante_final,
        datetime: partido.datetime,
        finalizado_en: partido.finalizado_en,
        jugadores: statsRows.map((s) => ({
          usuario_id: s.user_id,
          bando: bandoPorUser.get(s.user_id) ?? null,
          goles: s.goles ?? 0,
          asistencias: s.asistencias ?? 0,
          puntos_personales: s.puntos_personales ?? 0,
          amarillas: s.amarillas ?? 0,
          rojas: s.rojas ?? 0,
          usuario: s.jugador
            ? {
              id: s.jugador.id,
              nick: s.jugador.nick,
              name: s.jugador.name,
              photo: s.jugador.photo,
            }
            : null,
        })),
      };
    }
  }

  return {
    ok: true,
    data: {
      ...serializarEvento(evento),
      creado_por: evento.creadoPor
        ? {
            id: evento.creadoPor.id,
            nick: evento.creadoPor.nick,
            name: evento.creadoPor.name,
            photo: evento.creadoPor.photo,
          }
        : null,
      mi_respuesta: miConfirmacion?.respuesta ?? null,
      puede_responder: enDivision,
      puede_gestionar: puedeGestionar,
      confirmaciones: puedeGestionar
        ? (evento.confirmaciones ?? []).map((c) => ({
          usuario_id: c.usuario_id,
          respuesta: c.respuesta,
          usuario: c.usuario
            ? {
              id: c.usuario.id,
              nick: c.usuario.nick,
              name: c.usuario.name,
              photo: c.usuario.photo,
            }
            : null,
        }))
        : undefined,
      asistencias: puedeGestionar
        ? asistenciasRows.map((a) => ({
          usuario_id: a.usuario_id,
          estado: a.estado,
        }))
        : undefined,
      evaluaciones: puedeGestionar
        ? evaluacionesRows.map((ev) => ({
          id: ev.id,
          usuario_id: ev.usuario_id,
          notas_generales: ev.notas_generales,
          creado_at: ev.creado_at,
          detalles: (ev.detalles ?? []).map((d) => ({
            metrica_id: d.metrica_id,
            calificacion: d.calificacion,
            nombre_metrica: d.metrica?.nombre_metrica ?? null,
          })),
        }))
        : undefined,
      fogueo,
    },
  };
};

export const listarLugaresDivision = async (clubId, divisionId) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const eventos = await ClubEventos.findAll({
    where: {
      club_division_id: divisionId,
      lugar: { [Op.ne]: null },
    },
    attributes: ['lugar', 'fecha_hora'],
    order: [['fecha_hora', 'DESC']],
    limit: 30,
  });

  const vistos = new Set();
  const lugares = [];
  for (const ev of eventos) {
    const lugar = ev.lugar?.trim();
    if (!lugar || vistos.has(lugar.toLowerCase())) continue;
    vistos.add(lugar.toLowerCase());
    lugares.push(lugar);
  }

  return { ok: true, data: lugares };
};

export const responderConfirmacionEvento = async ({
  clubId,
  eventoId,
  userId,
  respuesta,
}) => {
  const resp = respuesta?.toUpperCase();
  if (!['VOY', 'NO_VOY'].includes(resp)) {
    return { ok: false, status: 400, error: 'respuesta inválida' };
  }

  const evento = await ClubEventos.findByPk(eventoId, {
    include: [{ model: ClubDivisiones, as: 'division', attributes: ['id', 'club_id'] }],
  });
  if (!evento || evento.division?.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Evento no encontrado' };
  }

  const enDivision = await usuarioEstaEnNominaDivision(clubId, evento.club_division_id, userId);
  if (!enDivision) {
    return { ok: false, status: 403, error: 'No perteneces a la nómina de esta división' };
  }

  const [row] = await ClubEventoConfirmaciones.findOrCreate({
    where: { evento_id: eventoId, usuario_id: userId },
    defaults: {
      evento_id: eventoId,
      usuario_id: userId,
      respuesta: resp,
      respondido_at: new Date(),
    },
  });

  if (row.respuesta !== resp) {
    await row.update({ respuesta: resp, respondido_at: new Date() });
  }

  const confirmaciones = await ClubEventoConfirmaciones.findAll({
    where: { evento_id: eventoId },
    attributes: ['respuesta'],
  });

  return {
    ok: true,
    data: {
      respuesta: resp,
      rsvp: contarConfirmaciones(confirmaciones),
    },
  };
};

export const calcularResumenEntrenamientosClub = async (clubId) => {
  const divisiones = await ClubDivisiones.findAll({
    where: { club_id: clubId },
    attributes: ['id'],
  });
  const divisionIds = divisiones.map((d) => d.id);
  if (!divisionIds.length) {
    return { ok: true, data: { asistencia_promedio: 0, eventos_pasados: 0 } };
  }

  const ahora = new Date();
  const eventos = await ClubEventos.findAll({
    where: {
      club_division_id: { [Op.in]: divisionIds },
      tipo: 'ENTRENAMIENTO',
      [Op.or]: [
        { completado_at: { [Op.ne]: null } },
        { fecha_hora: { [Op.lt]: ahora } },
      ],
    },
    attributes: ['id', 'asistencia_real_pct', 'completado_at'],
  });

  if (!eventos.length) {
    return { ok: true, data: { asistencia_promedio: 0, eventos_pasados: 0 } };
  }

  const eventoIds = eventos.map((e) => e.id);
  const asistencias = await ClubEventoAsistencias.findAll({
    where: { evento_id: { [Op.in]: eventoIds } },
    attributes: ['evento_id', 'estado'],
  });

  let sumPct = 0;
  let eventosConDatos = 0;

  eventos.forEach((evento) => {
    if (evento.asistencia_real_pct != null) {
      sumPct += evento.asistencia_real_pct;
      eventosConDatos += 1;
      return;
    }
    const regs = asistencias.filter((a) => a.evento_id === evento.id);
    if (!regs.length) return;
    const presentes = regs.filter((a) => a.estado === 'PRESENTE').length;
    sumPct += (presentes / regs.length) * 100;
    eventosConDatos += 1;
  });

  return {
    ok: true,
    data: {
      asistencia_promedio: eventosConDatos ? Math.round(sumPct / eventosConDatos) : 0,
      eventos_pasados: eventos.length,
    },
  };
};

export const serializarAtleta = (atleta) => {
  const json = typeof atleta.toJSON === 'function' ? atleta.toJSON() : atleta;
  return {
    id: json.id,
    club_division_id: json.club_division_id,
    usuario_id: json.usuario_id,
    dorsal: json.dorsal ?? null,
    posicion: json.posicion ?? null,
    estado: json.estado,
    fecha_ingreso: json.fecha_ingreso,
    usuario: json.usuario
      ? {
          id: json.usuario.id,
          nick: json.usuario.nick,
          name: json.usuario.name,
          photo: json.usuario.photo,
        }
      : null,
  };
};

export const listarAtletasDivision = async (clubId, divisionId) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const atletas = await ClubDivisionAtletas.findAll({
    where: { club_division_id: divisionId },
    include: [{ model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] }],
    order: [['dorsal', 'ASC'], ['id', 'ASC']],
  });

  return { ok: true, data: atletas.map(serializarAtleta) };
};

export const usuarioEstaEnNominaDivision = async (clubId, divisionId, usuarioId) => {
  if (!clubId || !divisionId || !usuarioId) return false;
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return false;

  const row = await ClubDivisionAtletas.findOne({
    where: {
      club_division_id: divisionId,
      usuario_id: usuarioId,
      estado: { [Op.ne]: 'INACTIVO' },
    },
    attributes: ['id'],
  });
  return Boolean(row);
};

export const sincronizarEquipoANominaDivision = async ({
  divisionId,
  equipoId,
  transaction = null,
}) => {
  if (!divisionId || !equipoId) return;

  const miembros = await TeamMiembros.findAll({
    where: { team_id: equipoId, estado_invitacion: 'ACEPTADO' },
    transaction,
  });

  await Promise.all(
    miembros.map(async (m) => {
      const [atleta] = await ClubDivisionAtletas.findOrCreate({
        where: { club_division_id: divisionId, usuario_id: m.user_id },
        defaults: {
          club_division_id: divisionId,
          usuario_id: m.user_id,
          dorsal: m.dorsal_habitual ?? null,
          posicion: m.position?.trim() || null,
          estado: 'ACTIVO',
          fecha_ingreso: m.fecha_union ?? new Date(),
        },
        transaction,
      });

      if (atleta.dorsal == null && m.dorsal_habitual != null) {
        await atleta.update({ dorsal: m.dorsal_habitual }, { transaction });
      }
      if (!atleta.posicion && m.position?.trim()) {
        await atleta.update({ posicion: m.position.trim() }, { transaction });
      }
    }),
  );
};

export const calcularAsistenciaPromedioDivision = async (divisionId) => {
  const ahora = new Date();
  const eventos = await ClubEventos.findAll({
    where: {
      club_division_id: divisionId,
      tipo: 'ENTRENAMIENTO',
      [Op.or]: [
        { completado_at: { [Op.ne]: null } },
        { fecha_hora: { [Op.lt]: ahora } },
      ],
    },
    attributes: ['id', 'asistencia_real_pct'],
  });

  if (!eventos.length) {
    return { asistencia_promedio: 0, sin_datos: true };
  }

  const eventoIds = eventos.map((e) => e.id);
  const asistencias = await ClubEventoAsistencias.findAll({
    where: { evento_id: { [Op.in]: eventoIds } },
    attributes: ['evento_id', 'estado'],
  });

  let sumPct = 0;
  let eventosConDatos = 0;

  eventos.forEach((evento) => {
    if (evento.asistencia_real_pct != null) {
      sumPct += evento.asistencia_real_pct;
      eventosConDatos += 1;
      return;
    }
    const regs = asistencias.filter((a) => a.evento_id === evento.id);
    if (!regs.length) return;
    const presentes = regs.filter((a) => a.estado === 'PRESENTE').length;
    sumPct += (presentes / regs.length) * 100;
    eventosConDatos += 1;
  });

  if (!eventosConDatos) {
    return { asistencia_promedio: 0, sin_datos: true };
  }

  return {
    asistencia_promedio: Math.round(sumPct / eventosConDatos),
    sin_datos: false,
  };
};

export const obtenerDetalleDivision = async (clubId, divisionId, viewerId) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const division = await ClubDivisiones.findOne({
    where: { id: divisionId, club_id: clubId },
    include: [
      { model: User, as: 'encargado', attributes: ['id', 'nick', 'name', 'photo'] },
      {
        model: Team,
        as: 'equipos',
        attributes: ['id', 'name', 'logo_url', 'capitan_id', 'club_division_id', 'genero', 'categoria_edad'],
        include: [
          { model: User, as: 'capitan', attributes: ['id', 'nick', 'name', 'photo'] },
        ],
      },
    ],
  });

  if (!division) return { ok: false, status: 404, error: 'División no encontrada' };

  const club = await Clubs.findByPk(clubId, {
    include: [
      { model: User, as: 'admin', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: Sports, as: 'sport', attributes: ['id', 'name'] },
    ],
  });

  const atletasRes = await listarAtletasDivision(clubId, divisionId);
  const asistencia = await calcularAsistenciaPromedioDivision(divisionId);
  const puedeGestionar = await puedeGestionarDivision(clubId, divisionId, viewerId);
  const esAdmin = usuarioEsAdminClub(club, viewerId);

  let invitacionesPendientes = [];
  if (puedeGestionar) {
    const pendientes = await ClubDivisionInvitaciones.findAll({
      where: { club_division_id: divisionId, estado: 'PENDIENTE' },
      include: [
        { model: User, as: 'invitado', attributes: ['id', 'nick', 'name', 'photo'] },
        { model: User, as: 'invitador', attributes: ['id', 'nick', 'name', 'photo'] },
      ],
      order: [['created_at', 'DESC']],
    });
    invitacionesPendientes = pendientes.map(serializarInvitacionDivision);
  }

  const divisionJson = serializarDivision(division);
  const equipos = (division.equipos ?? []).map(serializarEquipoClub);

  return {
    ok: true,
    data: {
      club: club
        ? {
            id: club.id,
            nombre: club.nombre,
            logo_url: club.logo_url,
            sport: club.sport ? { id: club.sport.id, name: club.sport.name } : null,
            admin: club.admin
              ? {
                  id: club.admin.id,
                  nick: club.admin.nick,
                  name: club.admin.name,
                  photo: club.admin.photo,
                }
              : null,
          }
        : null,
      division: {
        ...divisionJson,
        equipos,
      },
      atletas: atletasRes.data ?? [],
      invitaciones_pendientes: invitacionesPendientes,
      contadores: {
        jugadores: atletasRes.data?.length ?? 0,
        equipos: equipos.length,
        asistencia_promedio: asistencia.asistencia_promedio,
        asistencia_sin_datos: asistencia.sin_datos,
      },
      permisos: {
        puede_gestionar: puedeGestionar,
        es_admin: esAdmin,
      },
    },
  };
};

export const agregarAtletaDivision = async ({
  clubId,
  divisionId,
  userId,
  usuarioId,
  dorsal = null,
  posicion = null,
  estado = 'ACTIVO',
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const puede = await puedeGestionarDivision(clubId, divisionId, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para gestionar la nómina' };

  const targetId = parseId(usuarioId);
  if (!targetId) return { ok: false, status: 400, error: 'usuario_id inválido' };

  const usuario = await User.findByPk(targetId, { attributes: ['id'] });
  if (!usuario) return { ok: false, status: 404, error: 'Usuario no encontrado' };

  const estadoNorm = String(estado).toUpperCase();
  if (!ESTADOS_ATLETA.includes(estadoNorm)) {
    return { ok: false, status: 400, error: 'estado inválido' };
  }

  const existente = await ClubDivisionAtletas.findOne({
    where: { club_division_id: divisionId, usuario_id: targetId },
  });
  if (existente) {
    return { ok: false, status: 409, error: 'El jugador ya está en la nómina de esta división' };
  }

  const atleta = await ClubDivisionAtletas.create({
    club_division_id: divisionId,
    usuario_id: targetId,
    dorsal: dorsal != null ? parseInt(dorsal, 10) : null,
    posicion: posicion?.trim() || null,
    estado: estadoNorm,
  });

  const completo = await ClubDivisionAtletas.findByPk(atleta.id, {
    include: [{ model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] }],
  });

  await asegurarMiembroClub({
    clubId,
    usuarioId: targetId,
    rolMembresia: 'MIEMBRO',
  });

  return { ok: true, data: serializarAtleta(completo) };
};

export const actualizarAtletaDivision = async ({
  clubId,
  divisionId,
  atletaId,
  userId,
  updates = {},
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const puede = await puedeGestionarDivision(clubId, divisionId, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para gestionar la nómina' };

  const atleta = await ClubDivisionAtletas.findOne({
    where: { id: atletaId, club_division_id: divisionId },
  });
  if (!atleta) return { ok: false, status: 404, error: 'Atleta no encontrado en la nómina' };

  const patch = {};
  if (updates.dorsal !== undefined) {
    patch.dorsal = updates.dorsal != null && updates.dorsal !== ''
      ? parseInt(updates.dorsal, 10)
      : null;
  }
  if (updates.posicion !== undefined) {
    patch.posicion = updates.posicion?.trim() || null;
  }
  if (updates.estado != null) {
    const estadoNorm = String(updates.estado).toUpperCase();
    if (!ESTADOS_ATLETA.includes(estadoNorm)) {
      return { ok: false, status: 400, error: 'estado inválido' };
    }
    patch.estado = estadoNorm;
  }

  await atleta.update(patch);
  const completo = await ClubDivisionAtletas.findByPk(atleta.id, {
    include: [{ model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] }],
  });

  return { ok: true, data: serializarAtleta(completo) };
};

export const eliminarAtletaDivision = async ({
  clubId,
  divisionId,
  atletaId,
  userId,
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const puede = await puedeGestionarDivision(clubId, divisionId, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para gestionar la nómina' };

  const atleta = await ClubDivisionAtletas.findOne({
    where: { id: atletaId, club_division_id: divisionId },
  });
  if (!atleta) return { ok: false, status: 404, error: 'Atleta no encontrado en la nómina' };

  await atleta.destroy();
  return { ok: true };
};

export const serializarInvitacionDivision = (row) => {
  const json = typeof row.toJSON === 'function' ? row.toJSON() : row;
  return {
    id: json.id,
    club_division_id: json.club_division_id,
    usuario_invitado_id: json.usuario_invitado_id,
    invitado_por_id: json.invitado_por_id,
    estado: json.estado,
    created_at: json.created_at,
    invitado: json.invitado
      ? {
          id: json.invitado.id,
          nick: json.invitado.nick,
          name: json.invitado.name,
          photo: json.invitado.photo,
        }
      : null,
    invitador: json.invitador
      ? {
          id: json.invitador.id,
          nick: json.invitador.nick,
          name: json.invitador.name,
          photo: json.invitador.photo,
        }
      : null,
  };
};

export const invitarAtletaDivision = async ({
  clubId,
  divisionId,
  userId,
  usuarioInvitadoId,
  invitador,
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const puede = await puedeGestionarDivision(clubId, divisionId, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para invitar jugadores a la nómina' };

  const targetId = parseId(usuarioInvitadoId);
  if (!targetId) return { ok: false, status: 400, error: 'usuario_id inválido' };

  if (targetId === userId) {
    return { ok: false, status: 400, error: 'No puedes invitarte a ti mismo' };
  }

  const usuarioInvitado = await User.findByPk(targetId, {
    attributes: ['id', 'nick', 'name', 'photo'],
  });
  if (!usuarioInvitado) return { ok: false, status: 404, error: 'Usuario no encontrado' };

  const enNomina = await usuarioEstaEnNominaDivision(clubId, divisionId, targetId);
  if (enNomina) {
    return { ok: false, status: 409, error: 'El jugador ya está en la nómina de esta división' };
  }

  const pendiente = await ClubDivisionInvitaciones.findOne({
    where: {
      club_division_id: divisionId,
      usuario_invitado_id: targetId,
      estado: 'PENDIENTE',
    },
  });
  if (pendiente) {
    return { ok: false, status: 409, error: 'Ya existe una invitación pendiente para este jugador' };
  }

  const division = await ClubDivisiones.findOne({
    where: { id: divisionId, club_id: clubId },
    attributes: ['id', 'nombre', 'club_id'],
  });
  if (!division) return { ok: false, status: 404, error: 'División no encontrada' };

  const club = await Clubs.findByPk(clubId, {
    attributes: ['id', 'nombre', 'logo_url'],
  });

  let invitacion;
  let reinvitacion = false;

  const previa = await ClubDivisionInvitaciones.findOne({
    where: { club_division_id: divisionId, usuario_invitado_id: targetId },
    order: [['id', 'DESC']],
  });

  if (previa?.estado === 'RECHAZADA') {
    reinvitacion = true;
    await previa.update({
      estado: 'PENDIENTE',
      invitado_por_id: userId,
      updated_at: new Date(),
    });
    invitacion = previa;
  } else if (previa?.estado === 'ACEPTADA') {
    return { ok: false, status: 409, error: 'El jugador ya aceptó una invitación a esta división' };
  } else {
    invitacion = await ClubDivisionInvitaciones.create({
      club_division_id: divisionId,
      usuario_invitado_id: targetId,
      invitado_por_id: userId,
      estado: 'PENDIENTE',
    });
  }

  const completa = await ClubDivisionInvitaciones.findByPk(invitacion.id, {
    include: [
      { model: User, as: 'invitado', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: User, as: 'invitador', attributes: ['id', 'nick', 'name', 'photo'] },
    ],
  });

  await notificarInvitacionClubDivision({
    invitacionId: invitacion.id,
    usuarioInvitadoId: targetId,
    invitador: invitador ?? { id: userId },
    club,
    division,
  });

  return {
    ok: true,
    status: reinvitacion ? 200 : 201,
    data: serializarInvitacionDivision(completa),
  };
};

export const obtenerInvitacionDivisionDetalle = async ({
  clubId,
  divisionId,
  invitacionId,
  viewerId,
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const invitacion = await ClubDivisionInvitaciones.findOne({
    where: { id: invitacionId, club_division_id: divisionId },
    include: [
      { model: User, as: 'invitado', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: User, as: 'invitador', attributes: ['id', 'nick', 'name', 'photo'] },
      {
        model: ClubDivisiones,
        as: 'division',
        attributes: ['id', 'nombre', 'genero', 'categoria_edad', 'club_id'],
      },
    ],
  });

  if (!invitacion) return { ok: false, status: 404, error: 'Invitación no encontrada' };

  const esInvitado = invitacion.usuario_invitado_id === viewerId;
  const puedeGestionar = await puedeGestionarDivision(clubId, divisionId, viewerId);
  if (!esInvitado && !puedeGestionar) {
    return { ok: false, status: 403, error: 'Sin permiso para ver esta invitación' };
  }

  const club = await Clubs.findByPk(clubId, {
    attributes: ['id', 'nombre', 'logo_url'],
    include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
  });

  return {
    ok: true,
    data: {
      invitacion: serializarInvitacionDivision(invitacion),
      division: invitacion.division ? serializarDivision(invitacion.division) : null,
      club: club
        ? {
            id: club.id,
            nombre: club.nombre,
            logo_url: club.logo_url,
            sport: club.sport ? { id: club.sport.id, name: club.sport.name } : null,
          }
        : null,
    },
  };
};

export const responderInvitacionDivision = async ({
  clubId,
  divisionId,
  invitacionId,
  userId,
  respuesta,
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const respuestaNorm = String(respuesta ?? '').toUpperCase();
  if (!['ACEPTADA', 'RECHAZADA'].includes(respuestaNorm)) {
    return { ok: false, status: 400, error: 'respuesta debe ser ACEPTADA o RECHAZADA' };
  }

  const invitacion = await ClubDivisionInvitaciones.findOne({
    where: { id: invitacionId, club_division_id: divisionId },
    include: [
      { model: User, as: 'invitado', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: User, as: 'invitador', attributes: ['id', 'nick', 'name', 'photo'] },
      {
        model: ClubDivisiones,
        as: 'division',
        attributes: ['id', 'nombre', 'club_id'],
      },
    ],
  });

  if (!invitacion) return { ok: false, status: 404, error: 'Invitación no encontrada' };

  if (invitacion.usuario_invitado_id !== userId) {
    return { ok: false, status: 403, error: 'Solo el jugador invitado puede responder' };
  }

  if (invitacion.estado !== 'PENDIENTE') {
    return { ok: false, status: 409, error: 'Esta invitación ya fue respondida' };
  }

  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'nombre'] });
  const division = invitacion.division;

  const result = await sequelize.transaction(async (transaction) => {
    await invitacion.update({ estado: respuestaNorm, updated_at: new Date() }, { transaction });

    if (respuestaNorm === 'ACEPTADA') {
      const existente = await ClubDivisionAtletas.findOne({
        where: { club_division_id: divisionId, usuario_id: userId },
        transaction,
      });
      if (!existente) {
        await ClubDivisionAtletas.create({
          club_division_id: divisionId,
          usuario_id: userId,
          dorsal: null,
          posicion: null,
          estado: 'ACTIVO',
        }, { transaction });
      }

      const [miembro, created] = await ClubMiembros.findOrCreate({
        where: { club_id: clubId, usuario_id: userId },
        defaults: {
          club_id: clubId,
          usuario_id: userId,
          rol_membresia: 'MIEMBRO',
          estado: 'ACTIVO',
        },
        transaction,
      });
      if (!created && miembro.estado !== 'ACTIVO') {
        await miembro.update({ estado: 'ACTIVO' }, { transaction });
      }
    }

    await notificarRespuestaInvitacionClubDivision({
      invitadorId: invitacion.invitado_por_id,
      jugador: invitacion.invitado,
      division,
      aceptada: respuestaNorm === 'ACEPTADA',
      invitacionId: invitacion.id,
      transaction,
    });

    return invitacion;
  });

  const completa = await ClubDivisionInvitaciones.findByPk(result.id, {
    include: [
      { model: User, as: 'invitado', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: User, as: 'invitador', attributes: ['id', 'nick', 'name', 'photo'] },
    ],
  });

  return { ok: true, data: serializarInvitacionDivision(completa) };
};

const listarAtletasConEquiposDivision = async (clubId, divisionId) => {
  const atletasRes = await listarAtletasDivision(clubId, divisionId);
  if (!atletasRes.ok) return atletasRes;

  const equiposDivision = await Team.findAll({
    where: { club_id: clubId, club_division_id: divisionId },
    attributes: ['id', 'name'],
    include: [{
      model: TeamMiembros,
      as: 'miembros',
      where: { estado_invitacion: 'ACEPTADO' },
      required: false,
      attributes: ['user_id'],
    }],
  });

  const equipoPorUsuario = new Map();
  for (const eq of equiposDivision) {
    for (const miembro of eq.miembros ?? []) {
      equipoPorUsuario.set(miembro.user_id, { id: eq.id, name: eq.name });
    }
  }

  return {
    ok: true,
    data: atletasRes.data.map((atleta) => ({
      usuario_id: atleta.usuario_id,
      usuario: atleta.usuario,
      dorsal: atleta.dorsal,
      posicion: atleta.posicion,
      estado: atleta.estado,
      equipo_actual: equipoPorUsuario.get(atleta.usuario_id) ?? null,
    })),
  };
};

export const obtenerPlantillaEquipoDivision = async ({
  clubId,
  divisionId,
  teamId,
  viewerId,
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const team = await Team.findOne({
    where: { id: teamId, club_id: clubId, club_division_id: divisionId },
    attributes: ['id', 'capitan_id'],
  });
  if (!team) return { ok: false, status: 404, error: 'Equipo no encontrado en la división' };

  const puedeGestionar = await puedeGestionarDivision(clubId, divisionId, viewerId);
  const esCapitan = team.capitan_id === viewerId;
  if (!puedeGestionar && !esCapitan) {
    return { ok: false, status: 403, error: 'Sin permiso para gestionar la plantilla' };
  }

  const atletasRes = await listarAtletasConEquiposDivision(clubId, divisionId);
  if (!atletasRes.ok) return atletasRes;

  const miembros = await TeamMiembros.findAll({
    where: { team_id: teamId, estado_invitacion: 'ACEPTADO' },
    attributes: ['user_id'],
  });
  const idsNomina = new Set(atletasRes.data.map((a) => a.usuario_id));
  const seleccionados = miembros
    .map((m) => m.user_id)
    .filter((uid) => idsNomina.has(uid));

  return {
    ok: true,
    data: {
      atletas: atletasRes.data,
      seleccionados,
      permisos: {
        puede_gestionar: puedeGestionar || esCapitan,
      },
    },
  };
};

export const asignarPlantillaEquipoDivision = async ({
  clubId,
  divisionId,
  teamId,
  userId,
  jugadorIds = [],
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const team = await Team.findOne({
    where: { id: teamId, club_id: clubId, club_division_id: divisionId },
    attributes: ['id', 'capitan_id'],
  });
  if (!team) return { ok: false, status: 404, error: 'Equipo no encontrado en la división' };

  const puedeGestionar = await puedeGestionarDivision(clubId, divisionId, userId);
  const esCapitan = team.capitan_id === userId;
  if (!puedeGestionar && !esCapitan) {
    return { ok: false, status: 403, error: 'Sin permiso para gestionar la plantilla' };
  }

  const ids = [...new Set(
    (Array.isArray(jugadorIds) ? jugadorIds : [])
      .map((id) => parseId(id))
      .filter(Boolean),
  )];

  for (const uid of ids) {
    const enNomina = await usuarioEstaEnNominaDivision(clubId, divisionId, uid);
    if (!enNomina) {
      return { ok: false, status: 400, error: 'Todos los jugadores deben estar en la nómina de la división' };
    }
  }

  await sequelize.transaction(async (transaction) => {
    const equiposDivision = await Team.findAll({
      where: { club_id: clubId, club_division_id: divisionId },
      attributes: ['id'],
      transaction,
    });
    const otrosEquiposIds = equiposDivision
      .map((eq) => eq.id)
      .filter((id) => id !== teamId);

    for (const uid of ids) {
      if (otrosEquiposIds.length) {
        await TeamMiembros.destroy({
          where: {
            user_id: uid,
            team_id: { [Op.in]: otrosEquiposIds },
          },
          transaction,
        });
      }

      const [membresia, created] = await TeamMiembros.findOrCreate({
        where: { team_id: teamId, user_id: uid },
        defaults: {
          team_id: teamId,
          user_id: uid,
          rol: uid === team.capitan_id ? 'CAPITAN' : 'JUGADOR',
          estado_invitacion: 'ACEPTADO',
          fecha_union: new Date(),
        },
        transaction,
      });

      if (!created) {
        await membresia.update({
          estado_invitacion: 'ACEPTADO',
          rol: uid === team.capitan_id ? 'CAPITAN' : 'JUGADOR',
        }, { transaction });
      }
    }

    const actuales = await TeamMiembros.findAll({
      where: { team_id: teamId },
      transaction,
    });

    for (const miembro of actuales) {
      if (miembro.user_id === team.capitan_id) continue;
      if (!ids.includes(miembro.user_id)) {
        await miembro.destroy({ transaction });
      }
    }
  });

  return { ok: true };
};

export const crearEquipoCompetenciaDivision = async ({
  clubId,
  divisionId,
  userId,
  nombre,
  jugadorIds = [],
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const puede = await puedeGestionarDivision(clubId, divisionId, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para crear equipos en esta división' };

  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'sport_id'] });
  if (!club?.sport_id) return { ok: false, status: 400, error: 'El club no tiene deporte configurado' };

  const name = nombre?.trim();
  if (!name) return { ok: false, status: 400, error: 'nombre es obligatorio' };

  const equipo = await sequelize.transaction(async (transaction) => {
    const team = await Team.create({
      name,
      sport_id: club.sport_id,
      capitan_id: userId,
      club_id: clubId,
      club_division_id: divisionId,
      privado: false,
      genero: null,
      categoria_edad: null,
      creado_at: new Date(),
    }, { transaction });

    await TeamMiembros.create({
      team_id: team.id,
      user_id: userId,
      rol: 'CAPITAN',
      estado_invitacion: 'ACEPTADO',
      fecha_union: new Date(),
    }, { transaction });

    await DataTeam.create({
      team_id: team.id,
      elo: 0,
      games: 0,
      win: 0,
      lose: 0,
      draw: 0,
      total: 0,
    }, { transaction });

    return team;
  });

  const completo = await Team.findByPk(equipo.id, {
    include: [{ model: User, as: 'capitan', attributes: ['id', 'nick', 'name', 'photo'] }],
  });

  const idsJugadores = (Array.isArray(jugadorIds) ? jugadorIds : [])
    .map((id) => parseId(id))
    .filter(Boolean);

  if (idsJugadores.length) {
    const asignacion = await asignarPlantillaEquipoDivision({
      clubId,
      divisionId,
      teamId: equipo.id,
      userId,
      jugadorIds: idsJugadores,
    });
    if (!asignacion.ok) {
      return asignacion;
    }
  }

  return { ok: true, data: serializarEquipoClub(completo) };
};

export const eliminarDivisionClub = async (clubId, divisionId, userId) => {
  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id'] });
  if (!club || !usuarioEsAdminClub(club, userId)) {
    return { ok: false, status: 403, error: 'Solo el administrador puede eliminar divisiones' };
  }

  const division = await ClubDivisiones.findOne({ where: { id: divisionId, club_id: clubId } });
  if (!division) return { ok: false, status: 404, error: 'División no encontrada' };

  if (division.nombre === DIVISION_DEFAULT_NOMBRE) {
    return { ok: false, status: 400, error: 'No se puede eliminar Plantel Principal' };
  }

  const equiposCount = await Team.count({ where: { club_id: clubId, club_division_id: divisionId } });
  if (equiposCount > 0) {
    return {
      ok: false,
      status: 409,
      error: 'Elimina o reasigna los equipos de competencia antes de borrar la división',
    };
  }

  await division.destroy();
  return { ok: true };
};

export const obtenerJugadoresDivision = async (clubId, divisionId) => {
  return listarAtletasConEquiposDivision(clubId, divisionId);
};

export const registrarAsistenciaEvento = async ({
  clubId,
  eventoId,
  userId,
  registros,
}) => {
  const evento = await ClubEventos.findByPk(eventoId, {
    include: [{ model: ClubDivisiones, as: 'division', attributes: ['id', 'club_id'] }],
  });
  if (!evento || evento.division?.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Evento no encontrado' };
  }

  const puede = await puedeGestionarDivision(clubId, evento.club_division_id, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para registrar asistencia' };

  const jugadoresRes = await obtenerJugadoresDivision(clubId, evento.club_division_id);
  const idsValidos = new Set(jugadoresRes.data.map((j) => j.usuario_id));

  await sequelize.transaction(async (transaction) => {
    for (const reg of registros) {
      const usuarioId = parseId(reg.usuario_id);
      const estado = reg.estado?.toUpperCase();
      if (!usuarioId || !idsValidos.has(usuarioId)) continue;
      if (!ESTADOS_ASISTENCIA.includes(estado)) continue;

      const [row] = await ClubEventoAsistencias.findOrCreate({
        where: { evento_id: eventoId, usuario_id: usuarioId },
        defaults: {
          evento_id: eventoId,
          usuario_id: usuarioId,
          estado,
          registrado_por: userId,
        },
        transaction,
      });

      if (row.estado !== estado) {
        await row.update({ estado, registrado_por: userId }, { transaction });
      }
    }
  });

  const asistencias = await ClubEventoAsistencias.findAll({
    where: { evento_id: eventoId },
    include: [{ model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] }],
  });

  return { ok: true, data: asistencias.map((a) => a.toJSON()) };
};

export const actualizarEventoEntrenamiento = async ({
  clubId,
  eventoId,
  userId,
  fechaHora,
  fechaHoraFin,
  lugar,
  descripcion,
}) => {
  const evento = await ClubEventos.findByPk(eventoId, {
    include: [{ model: ClubDivisiones, as: 'division', attributes: ['id', 'nombre', 'club_id'] }],
  });
  if (!evento || evento.division?.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Evento no encontrado' };
  }

  const puede = await puedeGestionarDivision(clubId, evento.club_division_id, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para editar el entrenamiento' };

  if (evento.completado_at) {
    return { ok: false, status: 400, error: 'No se puede editar un entrenamiento finalizado' };
  }

  const patch = {};
  if (fechaHora != null) {
    const inicio = new Date(fechaHora);
    if (Number.isNaN(inicio.getTime())) {
      return { ok: false, status: 400, error: 'fecha_hora inválida' };
    }
    patch.fecha_hora = inicio;
  }
  if (fechaHoraFin != null) {
    const fin = new Date(fechaHoraFin);
    if (Number.isNaN(fin.getTime())) {
      return { ok: false, status: 400, error: 'fecha_hora_fin inválida' };
    }
    patch.fecha_hora_fin = fin;
  }
  if (lugar != null) {
    const lugarTrim = String(lugar).trim();
    if (!lugarTrim) return { ok: false, status: 400, error: 'lugar requerido' };
    patch.lugar = lugarTrim;
  }
  if (descripcion !== undefined) {
    patch.descripcion = descripcion?.trim() ? String(descripcion).trim() : null;
  }

  if (patch.fecha_hora && patch.fecha_hora_fin && patch.fecha_hora_fin <= patch.fecha_hora) {
    return { ok: false, status: 400, error: 'La hora de fin debe ser posterior al inicio' };
  }
  if (patch.fecha_hora && !patch.fecha_hora_fin && evento.fecha_hora_fin) {
    const finActual = new Date(evento.fecha_hora_fin);
    if (finActual <= patch.fecha_hora) {
      return { ok: false, status: 400, error: 'La hora de fin debe ser posterior al inicio' };
    }
  }

  if (!Object.keys(patch).length) {
    return { ok: false, status: 400, error: 'Sin cambios' };
  }

  await evento.update(patch);
  await evento.reload({
    include: [{ model: ClubDivisiones, as: 'division', attributes: ['id', 'nombre', 'club_id'] }],
  });

  return { ok: true, data: serializarEvento(evento) };
};

export const finalizarEventoEntrenamiento = async ({
  clubId,
  eventoId,
  userId,
}) => {
  const evento = await ClubEventos.findByPk(eventoId, {
    include: [{
      model: ClubDivisiones,
      as: 'division',
      attributes: ['id', 'nombre', 'club_id'],
      include: [{ model: Clubs, as: 'club', attributes: ['id', 'nombre'] }],
    }],
  });
  if (!evento || evento.division?.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Evento no encontrado' };
  }

  const puede = await puedeGestionarDivision(clubId, evento.club_division_id, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para finalizar el entrenamiento' };

  const asistencias = await ClubEventoAsistencias.findAll({
    where: { evento_id: eventoId },
    attributes: ['usuario_id', 'estado'],
  });

  let asistenciaRealPct = 0;
  if (asistencias.length) {
    const presentes = asistencias.filter((a) => a.estado === 'PRESENTE').length;
    asistenciaRealPct = Math.round((presentes / asistencias.length) * 100);
  }

  const yaEstabaCompletado = Boolean(evento.completado_at);

  await evento.update({
    completado_at: evento.completado_at ?? new Date(),
    asistencia_real_pct: asistenciaRealPct,
  });
  await evento.reload({
    include: [{
      model: ClubDivisiones,
      as: 'division',
      attributes: ['id', 'nombre', 'club_id'],
      include: [{ model: Clubs, as: 'club', attributes: ['id', 'nombre'] }],
    }],
  });

  // Notificar solo la primera vez que se finaliza.
  let notificacionesEnviadas = 0;
  if (!yaEstabaCompletado) {
    const presentesIds = asistencias
      .filter((a) => a.estado === 'PRESENTE')
      .map((a) => a.usuario_id)
      .filter(Boolean);

    const evaluaciones = presentesIds.length
      ? await ClubEventoEvaluacion.findAll({
        where: { evento_id: eventoId, usuario_id: presentesIds },
        attributes: ['id', 'usuario_id'],
        include: [{
          model: ClubEventoEvaluacionDetalle,
          as: 'detalles',
          attributes: ['calificacion'],
        }],
      })
      : [];

    const promedioPorUser = new Map();
    for (const ev of evaluaciones) {
      const notas = (ev.detalles ?? [])
        .map((d) => Number(d.calificacion))
        .filter((n) => Number.isFinite(n));
      if (!notas.length) continue;
      const avg = notas.reduce((s, n) => s + n, 0) / notas.length;
      promedioPorUser.set(ev.usuario_id, avg);
    }

    let scoreLocal = null;
    let scoreVisitante = null;
    let fogueoFinalizado = false;
    if (evento.partido_id) {
      const partido = await Partidos.findByPk(evento.partido_id, {
        attributes: ['id', 'state', 'score_local_final', 'score_visitante_final'],
      });
      if (partido) {
        fogueoFinalizado = partido.state === 'FINALIZADO';
        if (partido.score_local_final != null && partido.score_visitante_final != null) {
          scoreLocal = partido.score_local_final;
          scoreVisitante = partido.score_visitante_final;
        }
      }
    }

    const { notificarEntrenamientoFinalizado } = await import('./notificacionesService.js');
    const enviadas = await notificarEntrenamientoFinalizado({
      eventoId,
      clubNombre: evento.division?.club?.nombre,
      divisionNombre: evento.division?.nombre,
      scoreLocal,
      scoreVisitante,
      fogueoFinalizado,
      destinatarios: presentesIds.map((usuarioId) => ({
        usuarioId,
        promedio: promedioPorUser.get(usuarioId) ?? null,
      })),
    });
    notificacionesEnviadas = enviadas?.length ?? 0;
  }

  const resumenClub = await calcularResumenEntrenamientosClub(clubId);
  const asistenciaDivision = await calcularAsistenciaPromedioDivision(evento.club_division_id);

  return {
    ok: true,
    data: {
      ...serializarEvento(evento),
      asistencia_real_pct: asistenciaRealPct,
      completado: true,
      notificaciones_enviadas: notificacionesEnviadas,
      resumen_club: resumenClub.ok ? resumenClub.data : null,
      asistencia_division: asistenciaDivision,
    },
  };
};

export const listarMetricasDeporte = async (sportId) => {
  const metricas = await ClubMetricaEvaluacion.findAll({
    where: { sport_id: sportId },
    order: [['categoria', 'ASC'], ['nombre_metrica', 'ASC']],
  });
  return metricas.map((m) => m.toJSON());
};

export const guardarEvaluacionEvento = async ({
  clubId,
  eventoId,
  evaluadorId,
  usuarioId,
  notasGenerales,
  detalles,
}) => {
  const evento = await ClubEventos.findByPk(eventoId, {
    include: [
      { model: ClubDivisiones, as: 'division', attributes: ['id', 'club_id'] },
    ],
  });
  if (!evento || evento.division?.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Evento no encontrado' };
  }

  const puede = await puedeGestionarDivision(clubId, evento.club_division_id, evaluadorId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para evaluar' };

  const club = await Clubs.findByPk(clubId, { attributes: ['sport_id'] });
  const metricas = await ClubMetricaEvaluacion.findAll({ where: { sport_id: club.sport_id } });
  const metricaIds = new Set(metricas.map((m) => m.id));

  const evaluacion = await sequelize.transaction(async (transaction) => {
    const [evalRow] = await ClubEventoEvaluacion.findOrCreate({
      where: { evento_id: eventoId, usuario_id: usuarioId, evaluador_id: evaluadorId },
      defaults: {
        evento_id: eventoId,
        usuario_id: usuarioId,
        evaluador_id: evaluadorId,
        notas_generales: notasGenerales ?? null,
      },
      transaction,
    });

    if (notasGenerales != null) {
      await evalRow.update({ notas_generales: notasGenerales }, { transaction });
    }

    for (const det of detalles ?? []) {
      const metricaId = parseId(det.metrica_id);
      const calificacion = parseInt(det.calificacion, 10);
      if (!metricaId || !metricaIds.has(metricaId)) continue;
      if (!Number.isFinite(calificacion) || calificacion < 1 || calificacion > 10) continue;

      const [detRow] = await ClubEventoEvaluacionDetalle.findOrCreate({
        where: { evaluacion_id: evalRow.id, metrica_id: metricaId },
        defaults: { evaluacion_id: evalRow.id, metrica_id: metricaId, calificacion },
        transaction,
      });
      if (detRow.calificacion !== calificacion) {
        await detRow.update({ calificacion }, { transaction });
      }
    }

    return evalRow;
  });

  const completa = await ClubEventoEvaluacion.findByPk(evaluacion.id, {
    include: [{
      model: ClubEventoEvaluacionDetalle,
      as: 'detalles',
      include: [{ model: ClubMetricaEvaluacion, as: 'metrica' }],
    }],
  });

  return { ok: true, data: completa.toJSON() };
};

export const crearPracticaDivision = async ({
  clubId,
  divisionId,
  userId,
  datetime,
  lugar = null,
  bandoA = [],
  bandoB = [],
}) => {
  const valDivision = await validarDivisionPerteneceClub(clubId, divisionId);
  if (!valDivision.ok) return { ok: false, status: 400, error: valDivision.error };

  const puede = await puedeGestionarDivision(clubId, divisionId, userId);
  if (!puede) return { ok: false, status: 403, error: 'Sin permiso para programar práctica' };

  const idsA = bandoA.map((id) => parseId(id)).filter(Boolean);
  const idsB = bandoB.map((id) => parseId(id)).filter(Boolean);
  const setA = new Set(idsA);
  const overlap = idsB.some((id) => setA.has(id));
  if (overlap) {
    return { ok: false, status: 400, error: 'Un jugador no puede estar en ambos bandos' };
  }

  const jugadoresRes = await obtenerJugadoresDivision(clubId, divisionId);
  const idsValidos = new Set(jugadoresRes.data.map((j) => j.usuario_id));
  const todos = [...idsA, ...idsB];
  if (!todos.length) {
    return { ok: false, status: 400, error: 'Debes incluir al menos un jugador' };
  }
  if (todos.some((id) => !idsValidos.has(id))) {
    return { ok: false, status: 400, error: 'Hay jugadores que no pertenecen a la división' };
  }

  const equipos = await Team.findAll({
    where: { club_id: clubId, club_division_id: divisionId },
    attributes: ['id', 'name', 'sport_id', 'capitan_id'],
    limit: 1,
  });
  if (!equipos.length) {
    return { ok: false, status: 400, error: 'La división no tiene equipos para anclar la práctica' };
  }

  const equipoRef = equipos[0];
  const division = valDivision.division;
  const nombrePartido = `${division.nombre} — práctica interna`;

  const partido = await sequelize.transaction(async (transaction) => {
    const creado = await Partidos.create({
      name: nombrePartido,
      torneo_id: null,
      fase_torneo_id: null,
      grupo_division_id: null,
      sport_id: equipoRef.sport_id,
      cancha_id: null,
      datetime: datetime ? new Date(datetime) : null,
      state: 'PROGRAMADO',
      tipo: 'AMISTOSO',
      nivel_arbitraje: 'BASICO',
      programado_por_id: userId,
      club_division_id: divisionId,
    }, { transaction });

    await PartidoParticipantes.create(
      { partido_id: creado.id, team_id: equipoRef.id, es_local: true },
      { transaction },
    );
    await PartidoParticipantes.create(
      { partido_id: creado.id, team_id: equipoRef.id, es_local: false },
      { transaction },
    );

    let dorsal = 1;
    for (const usuarioId of idsA) {
      await PartidoNominas.create({
        partido_id: creado.id,
        team_id: equipoRef.id,
        user_id: usuarioId,
        dorsal: dorsal++,
        set_numero: 1,
        es_local: true,
      }, { transaction });
    }
    dorsal = 1;
    for (const usuarioId of idsB) {
      await PartidoNominas.create({
        partido_id: creado.id,
        team_id: equipoRef.id,
        user_id: usuarioId,
        dorsal: dorsal++,
        set_numero: 1,
        es_local: false,
      }, { transaction });
    }

    return creado;
  });

  return {
    ok: true,
    data: {
      id: partido.id,
      name: partido.name,
      datetime: partido.datetime,
      club_division_id: divisionId,
      es_practica_interna: true,
      lugar,
    },
  };
};

/**
 * Arma e inicia un fogueo desde un entrenamiento:
 * - Solo atletas con asistencia PRESENTE
 * - Bandos ficticios A/B (mismo Team ancla, es_local)
 * - Entrenador = árbitro confirmado
 * - Nóminas validadas + saque inicial listo para iniciar
 */
export const iniciarFogueoDesdeEvento = async ({
  clubId,
  eventoId,
  userId,
  bandoA = [],
  bandoB = [],
  equipoQueSaca = 'local',
}) => {
  const evento = await ClubEventos.findByPk(eventoId, {
    include: [{
      model: ClubDivisiones,
      as: 'division',
      attributes: ['id', 'nombre', 'club_id'],
    }],
  });

  if (!evento || evento.division?.club_id !== clubId) {
    return { ok: false, status: 404, error: 'Evento no encontrado' };
  }

  if (evento.completado) {
    return { ok: false, status: 400, error: 'El entrenamiento ya está finalizado' };
  }

  const puede = await puedeGestionarDivision(clubId, evento.club_division_id, userId);
  if (!puede) {
    return { ok: false, status: 403, error: 'Solo el entrenador/staff puede iniciar el fogueo' };
  }

  // Misma convención que torneos: 'local' | 'visitante' (minúsculas).
  // Acepta LOCAL/VISITANTE por compatibilidad con clientes viejos.
  const saqueRaw = String(equipoQueSaca || 'local').trim().toLowerCase();
  const saque = saqueRaw === 'local' || saqueRaw === 'visitante' ? saqueRaw : null;
  if (!saque) {
    return { ok: false, status: 400, error: "equipo_que_saca debe ser 'local' o 'visitante'" };
  }

  const idsA = bandoA.map((id) => parseId(id)).filter(Boolean);
  const idsB = bandoB.map((id) => parseId(id)).filter(Boolean);
  const setA = new Set(idsA);
  if (idsB.some((id) => setA.has(id))) {
    return { ok: false, status: 400, error: 'Un jugador no puede estar en ambos bandos' };
  }
  if (!idsA.length || !idsB.length) {
    return { ok: false, status: 400, error: 'Debes armar Equipo A y Equipo B con al menos un jugador cada uno' };
  }

  // Vóley: rotación en cancha requiere 6 titulares por bando (zonas 1-6).
  if (idsA.length < 6 || idsB.length < 6) {
    return {
      ok: false,
      status: 400,
      error: 'Cada equipo necesita al menos 6 jugadores presentes para la rotación en cancha (vóley)',
    };
  }

  const asistencias = await ClubEventoAsistencias.findAll({
    where: { evento_id: eventoId, estado: 'PRESENTE' },
    attributes: ['usuario_id'],
  });
  const presentes = new Set(asistencias.map((a) => a.usuario_id));
  if (!presentes.size) {
    return { ok: false, status: 400, error: 'Marca asistencia (Presente) antes de armar el fogueo' };
  }

  const todos = [...idsA, ...idsB];
  if (todos.some((id) => !presentes.has(id))) {
    return {
      ok: false,
      status: 400,
      error: 'Solo puedes incluir jugadores marcados como Presente en la asistencia',
    };
  }

  let repararMarcadorEnCurso = false;
  if (evento.partido_id) {
    const existente = await Partidos.findByPk(evento.partido_id, {
      attributes: ['id', 'state'],
    });
    if (existente?.state === 'EN_CURSO') {
      const marcador = await MarcadoresDetalle.findOne({
        where: { partido_id: existente.id },
        attributes: ['id', 'posiciones_actuales'],
      });
      const pos = marcador?.posiciones_actuales;
      const sinRotacion = !pos?.equipo_local && !pos?.equipo_visitante;
      if (!sinRotacion) {
        return {
          ok: true,
          data: {
            partido_id: existente.id,
            state: existente.state,
            ya_en_curso: true,
            es_practica_interna: true,
          },
        };
      }
      // Partido en curso sin rotación (bug de fogueo previo): rearmar nóminas/alineación.
      repararMarcadorEnCurso = true;
    }
    if (existente?.state === 'FINALIZADO') {
      return {
        ok: false,
        status: 400,
        error: 'Este entrenamiento ya tiene un fogueo finalizado',
      };
    }
  }

  const equipos = await Team.findAll({
    where: { club_id: clubId, club_division_id: evento.club_division_id },
    attributes: ['id', 'sport_id'],
    limit: 1,
  });
  if (!equipos.length) {
    return {
      ok: false,
      status: 400,
      error: 'La división no tiene un equipo para anclar el fogueo. Crea un equipo de la división primero.',
    };
  }

  const equipoRef = equipos[0];
  const divisionNombre = evento.division?.nombre || 'División';
  const ahora = new Date();

  const crearNominasBando = async ({
    ids,
    partidoId,
    esLocal,
    transaction,
  }) => {
    const alineacion = new Array(6).fill(null);
    let dorsal = 1;
    for (let i = 0; i < ids.length; i += 1) {
      const usuarioId = ids[i];
      const esTitular = i < 6;
      const zona = esTitular ? i + 1 : null;
      if (esTitular) alineacion[i] = usuarioId;

      await PartidoNominas.create({
        partido_id: partidoId,
        team_id: equipoRef.id,
        user_id: usuarioId,
        dorsal: dorsal++,
        set_numero: 1,
        es_local: esLocal,
        rol_nomina: esTitular ? 'TITULAR' : 'SUPLENTE',
        zona,
        propuesto_por_id: userId,
        validado_por_id: userId,
        estado_validacion: 'VALIDADO',
        validado_at: ahora,
      }, { transaction });
    }
    return alineacion;
  };

  const partidoId = await sequelize.transaction(async (transaction) => {
    let partido;
    if (evento.partido_id) {
      partido = await Partidos.findByPk(evento.partido_id, { transaction });
    }

    if (!partido) {
      partido = await crearPartidoPracticaInternaVacio({
        clubId,
        divisionId: evento.club_division_id,
        divisionNombre,
        userId,
        datetime: evento.fecha_hora || ahora,
        transaction,
      });
      await evento.update({ partido_id: partido.id }, { transaction });
    }

    await PartidoNominas.destroy({
      where: { partido_id: partido.id },
      transaction,
    });

    const alineacionLocal = await crearNominasBando({
      ids: idsA,
      partidoId: partido.id,
      esLocal: true,
      transaction,
    });
    const alineacionVisitante = await crearNominasBando({
      ids: idsB,
      partidoId: partido.id,
      esLocal: false,
      transaction,
    });

    await partido.update({
      name: `${divisionNombre} — fogueo`,
      state: repararMarcadorEnCurso ? 'EN_CURSO' : 'PROGRAMADO',
      tipo: 'AMISTOSO',
      nivel_arbitraje: 'BASICO',
      programado_por_id: userId,
      arbitro_asignado_id: userId,
      arbitro_confirmacion_estado: 'CONFIRMADO',
      equipo_que_saca_inicial: saque,
      club_division_id: evento.club_division_id,
      datetime: evento.fecha_hora || ahora,
      alineacion_local: alineacionLocal,
      alineacion_visitante: alineacionVisitante,
    }, { transaction });

    if (repararMarcadorEnCurso) {
      const marcador = await MarcadoresDetalle.findOne({
        where: { partido_id: partido.id },
        transaction,
      });
      if (marcador) {
        const alineacionesPorSet = await cargarAlineacionesPorSet(partido.id, transaction);
        const metrica = {
          ...(marcador.metrica_estructura ?? {}),
          alineaciones_por_set: alineacionesPorSet,
        };
        await marcador.update({
          posiciones_actuales: {
            equipo_local: alineacionLocal,
            equipo_visitante: alineacionVisitante,
          },
          equipo_que_saca: saque,
          metrica_estructura: metrica,
        }, { transaction });
      }
    }

    return partido.id;
  });

  return {
    ok: true,
    data: {
      partido_id: partidoId,
      state: repararMarcadorEnCurso ? 'EN_CURSO' : 'PROGRAMADO',
      ya_en_curso: repararMarcadorEnCurso,
      es_practica_interna: true,
      listo_para_iniciar: !repararMarcadorEnCurso,
      bando_a: idsA,
      bando_b: idsB,
      equipo_que_saca: saque,
    },
  };
};

/** ZYRA-0002 / zyra-2 → club_id. Mismo formato que genera la app al compartir. */
export const parseCodigoInvitacionClub = (codigo) => {
  const raw = String(codigo ?? '').trim().toUpperCase().replace(/[\s_]+/g, '');
  const match = raw.match(/^ZYRA-?0*([1-9]\d*)$/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const serializarClubResumenCodigo = (club) => ({
  id: club.id,
  nombre: club.nombre,
  logo_url: club.logo_url,
  ubicacion: club.ubicacion,
  sport: club.sport
    ? { id: club.sport.id, name: club.sport.name }
    : null,
});

export const serializarMembresiaSolicitud = (solicitud) => {
  const json = typeof solicitud.toJSON === 'function' ? solicitud.toJSON() : solicitud;
  return {
    id: json.id,
    club_id: json.club_id,
    usuario_id: json.usuario_id,
    estado: json.estado,
    origen: json.origen,
    rol_asignado: json.rol_asignado ?? null,
    resuelto_at: json.resuelto_at ?? null,
    creado_at: json.creado_at,
    usuario: json.usuario
      ? {
          id: json.usuario.id,
          nick: json.usuario.nick,
          name: json.usuario.name,
          photo: json.usuario.photo,
        }
      : null,
    club: json.club
      ? {
          id: json.club.id,
          nombre: json.club.nombre,
          logo_url: json.club.logo_url,
        }
      : null,
    resuelto_por: json.resueltoPor
      ? {
          id: json.resueltoPor.id,
          nick: json.resueltoPor.nick,
          name: json.resueltoPor.name,
          photo: json.resueltoPor.photo,
        }
      : null,
  };
};

/**
 * Solicita unirse al club por código (PENDIENTE). No crea ClubMiembros hasta aceptación.
 */
export const solicitarMembresiaPorCodigo = async ({ codigo, userId, solicitante }) => {
  const clubId = parseCodigoInvitacionClub(codigo);
  if (!clubId) {
    return {
      ok: false,
      status: 400,
      error: 'Código inválido. Usa el formato ZYRA-0001.',
    };
  }

  const club = await Clubs.findByPk(clubId, {
    include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
  });
  if (!club) {
    return {
      ok: false,
      status: 404,
      error: 'No encontramos un club con ese código.',
    };
  }

  const clubResumen = serializarClubResumenCodigo(club);

  if (club.admin_id === userId) {
    return {
      ok: true,
      status: 200,
      alreadyMember: true,
      data: { club: clubResumen, solicitud: null },
    };
  }

  const miembroActivo = await ClubMiembros.findOne({
    where: { club_id: clubId, usuario_id: userId, estado: 'ACTIVO' },
  });
  if (miembroActivo) {
    return {
      ok: true,
      status: 200,
      alreadyMember: true,
      data: {
        club: clubResumen,
        solicitud: null,
        membresia: {
          id: miembroActivo.id,
          club_id: miembroActivo.club_id,
          usuario_id: miembroActivo.usuario_id,
          rol_membresia: miembroActivo.rol_membresia,
          estado: miembroActivo.estado,
        },
      },
    };
  }

  const pendiente = await ClubMembresiaSolicitudes.findOne({
    where: { club_id: clubId, usuario_id: userId, estado: 'PENDIENTE' },
  });
  if (pendiente) {
    return {
      ok: true,
      status: 200,
      alreadyPending: true,
      data: {
        club: clubResumen,
        solicitud: serializarMembresiaSolicitud(pendiente),
      },
    };
  }

  const solicitud = await ClubMembresiaSolicitudes.create({
    club_id: clubId,
    usuario_id: userId,
    estado: 'PENDIENTE',
    origen: 'CODIGO',
  });

  const solicitanteRow = solicitante?.nick || solicitante?.name
    ? solicitante
    : await User.findByPk(userId, { attributes: ['id', 'nick', 'name', 'photo'] });

  await notificarSolicitudMembresiaClub({
    solicitudId: solicitud.id,
    club,
    solicitante: solicitanteRow ?? { id: userId },
  });

  const completa = await ClubMembresiaSolicitudes.findByPk(solicitud.id, {
    include: [
      { model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: Clubs, as: 'club', attributes: ['id', 'nombre', 'logo_url'] },
    ],
  });

  return {
    ok: true,
    status: 201,
    alreadyMember: false,
    alreadyPending: false,
    data: {
      club: clubResumen,
      solicitud: serializarMembresiaSolicitud(completa),
    },
  };
};

/** Alias retrocompatible del endpoint unirse-por-codigo. */
export const unirseClubPorCodigo = solicitarMembresiaPorCodigo;

export const listarMembresiaSolicitudes = async ({
  clubId,
  userId,
  estado = null,
}) => {
  const puede = await usuarioPuedeGestionarClub(clubId, userId);
  if (!puede.puede) {
    return { ok: false, status: 403, error: 'Sin permiso para ver solicitudes' };
  }

  const where = { club_id: clubId };
  if (estado) where.estado = String(estado).toUpperCase();

  const rows = await ClubMembresiaSolicitudes.findAll({
    where,
    include: [
      { model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: User, as: 'resueltoPor', attributes: ['id', 'nick', 'name', 'photo'] },
    ],
    order: [['creado_at', 'DESC']],
  });

  return {
    ok: true,
    data: rows.map(serializarMembresiaSolicitud),
  };
};

export const obtenerMembresiaSolicitudDetalle = async ({
  clubId,
  solicitudId,
  userId,
}) => {
  const puede = await usuarioPuedeGestionarClub(clubId, userId);
  if (!puede.puede) {
    return { ok: false, status: 403, error: 'Sin permiso' };
  }

  const solicitud = await ClubMembresiaSolicitudes.findOne({
    where: { id: solicitudId, club_id: clubId },
    include: [
      { model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: Clubs, as: 'club', attributes: ['id', 'nombre', 'logo_url', 'admin_id'] },
      { model: User, as: 'resueltoPor', attributes: ['id', 'nick', 'name', 'photo'] },
    ],
  });

  if (!solicitud) {
    return { ok: false, status: 404, error: 'Solicitud no encontrada' };
  }

  return { ok: true, data: serializarMembresiaSolicitud(solicitud) };
};

export const responderMembresiaSolicitud = async ({
  clubId,
  solicitudId,
  userId,
  respuesta,
  rolMembresia,
}) => {
  const puede = await usuarioPuedeGestionarClub(clubId, userId);
  if (!puede.puede) {
    return { ok: false, status: 403, error: 'Sin permiso para responder' };
  }

  const estado = String(respuesta || '').toUpperCase();
  if (!['ACEPTADA', 'RECHAZADA'].includes(estado)) {
    return { ok: false, status: 400, error: 'respuesta debe ser ACEPTADA o RECHAZADA' };
  }

  const rol = rolMembresia ? String(rolMembresia).toUpperCase() : null;
  if (estado === 'ACEPTADA') {
    if (!rol || !ROLES_ASIGNABLES_CODIGO.includes(rol)) {
      return {
        ok: false,
        status: 400,
        error: `rol_membresia obligatorio al aceptar. Usa uno de: ${ROLES_ASIGNABLES_CODIGO.join(', ')}`,
      };
    }
  }

  const solicitud = await ClubMembresiaSolicitudes.findOne({
    where: { id: solicitudId, club_id: clubId },
    include: [
      { model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: Clubs, as: 'club', attributes: ['id', 'nombre', 'logo_url', 'admin_id'] },
    ],
  });

  if (!solicitud) {
    return { ok: false, status: 404, error: 'Solicitud no encontrada' };
  }
  if (solicitud.estado !== 'PENDIENTE') {
    return { ok: false, status: 409, error: 'La solicitud ya fue resuelta' };
  }

  let membresia = null;

  await sequelize.transaction(async (transaction) => {
    await solicitud.update({
      estado,
      resuelto_por_id: userId,
      resuelto_at: new Date(),
      rol_asignado: estado === 'ACEPTADA' ? rol : null,
    }, { transaction });

    if (estado === 'ACEPTADA') {
      membresia = await asegurarMiembroClub({
        clubId,
        usuarioId: solicitud.usuario_id,
        rolMembresia: rol,
        transaction,
      });
    }
  });

  if (estado === 'ACEPTADA') {
    await notificarMembresiaClubAceptada({
      solicitudId: solicitud.id,
      club: solicitud.club,
      usuarioId: solicitud.usuario_id,
      rolMembresia: rol,
    });
  } else {
    await notificarMembresiaClubRechazada({
      solicitudId: solicitud.id,
      club: solicitud.club,
      usuarioId: solicitud.usuario_id,
    });
  }

  const actualizada = await ClubMembresiaSolicitudes.findByPk(solicitud.id, {
    include: [
      { model: User, as: 'usuario', attributes: ['id', 'nick', 'name', 'photo'] },
      { model: Clubs, as: 'club', attributes: ['id', 'nombre', 'logo_url'] },
      { model: User, as: 'resueltoPor', attributes: ['id', 'nick', 'name', 'photo'] },
    ],
  });

  return {
    ok: true,
    data: {
      solicitud: serializarMembresiaSolicitud(actualizada),
      membresia: membresia
        ? {
            id: membresia.id,
            club_id: membresia.club_id,
            usuario_id: membresia.usuario_id,
            rol_membresia: membresia.rol_membresia,
            estado: membresia.estado,
          }
        : null,
    },
  };
};
