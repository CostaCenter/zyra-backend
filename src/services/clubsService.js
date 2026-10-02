import { Op } from 'sequelize';
import {
  Clubs,
  ClubDivisiones,
  ClubMiembros,
  ClubDivisionAtletas,
  Team,
  Sports,
  User,
  Torneos,
  TeamMiembros,
} from '../db/db.js';
import { mapUserForClient } from '../utils/userAvatar.js';

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

export const buscarClub = async (clubId, { transaction = null } = {}) =>
  Clubs.findByPk(clubId, {
    transaction,
    include: [
      { model: Sports, as: 'sport', attributes: ['id', 'name'] },
      { model: User, as: 'admin', attributes: ['id', 'nick', 'name', 'photo', 'foto_portada_url'] },
    ],
  });

export const usuarioEsAdminClub = (club, userId) =>
  club && Number(club.admin_id) === Number(userId);

export const usuarioPuedeGestionarClub = async (clubId, userId) => {
  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id'] });
  if (!club) return { club: null, puede: false, esAdmin: false, divisionIdsGestionables: [] };

  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) {
    return { club, puede: false, esAdmin: false, divisionIdsGestionables: [] };
  }

  const esAdmin = usuarioEsAdminClub(club, uid);
  if (esAdmin) {
    const todas = await ClubDivisiones.findAll({
      where: { club_id: clubId },
      attributes: ['id'],
    });
    return {
      club,
      puede: true,
      esAdmin: true,
      divisionIdsGestionables: todas.map((d) => d.id),
    };
  }

  const divisionesEncargadas = await ClubDivisiones.findAll({
    where: { club_id: clubId, encargado_id: uid },
    attributes: ['id'],
  });
  const divisionIdsGestionables = divisionesEncargadas.map((d) => d.id);

  return {
    club,
    puede: divisionIdsGestionables.length > 0,
    esAdmin: false,
    divisionIdsGestionables,
  };
};

export const usuarioPuedeResponderSolicitud = async (clubId, clubDivisionId, userId) => {
  const club = await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id', 'nombre'] });
  if (!club) return { club: null, puede: false };

  if (usuarioEsAdminClub(club, userId)) {
    return { club, puede: true };
  }

  if (clubDivisionId) {
    const division = await ClubDivisiones.findOne({
      where: { id: clubDivisionId, club_id: clubId },
      attributes: ['id', 'encargado_id', 'nombre'],
    });
    if (division && Number(division.encargado_id) === Number(userId)) {
      return { club, division, puede: true };
    }
  }

  return { club, puede: false };
};

/**
 * Permisos de publicación de avisos por rol:
 * - Admin: cualquier alcance
 * - Encargado: su(s) división(es) y equipos dentro de ellas
 * - Atleta/miembro (ClubDivisionAtleta): solo su(s) propia(s) división(es), sin club completo ni equipos
 */
export const obtenerPermisosPublicacionAviso = async (clubId, userId, club = null) => {
  const clubRow = club || await Clubs.findByPk(clubId, { attributes: ['id', 'admin_id'] });
  if (!clubRow || !userId) {
    return {
      puede_publicar: false,
      puede_club_completo: false,
      division_ids: [],
      equipo_division_ids: [],
      rol: 'ninguno',
    };
  }

  if (usuarioEsAdminClub(clubRow, userId)) {
    return {
      puede_publicar: true,
      puede_club_completo: true,
      division_ids: null,
      equipo_division_ids: null,
      rol: 'admin',
    };
  }

  const [encargadas, atletas] = await Promise.all([
    ClubDivisiones.findAll({
      where: { club_id: clubId, encargado_id: userId },
      attributes: ['id'],
    }),
    ClubDivisionAtletas.findAll({
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
      attributes: ['club_division_id'],
    }),
  ]);

  const encargadoIds = encargadas.map((d) => d.id);
  const atletaIds = [...new Set(
    atletas.map((a) => a.club_division_id || a.division?.id).filter(Boolean),
  )];
  const divisionIds = [...new Set([...encargadoIds, ...atletaIds])];

  if (!divisionIds.length) {
    return {
      puede_publicar: false,
      puede_club_completo: false,
      division_ids: [],
      equipo_division_ids: [],
      rol: 'ninguno',
    };
  }

  return {
    puede_publicar: true,
    puede_club_completo: false,
    division_ids: divisionIds,
    equipo_division_ids: encargadoIds,
    rol: encargadoIds.length ? 'encargado' : 'miembro',
  };
};

/** Usuarios únicos activos por club: miembros, atletas, planteles y admin. */
const contarMiembrosActivosPorClubIds = async (clubIds) => {
  const ids = [...new Set(clubIds.map((id) => parseId(id)).filter(Boolean))];
  const counts = Object.fromEntries(ids.map((id) => [id, 0]));
  if (!ids.length) return counts;

  const sets = Object.fromEntries(ids.map((id) => [id, new Set()]));
  const addUsuario = (clubId, userId) => {
    const cid = parseId(clubId);
    const uid = parseId(userId);
    if (!cid || !uid || !sets[cid]) return;
    sets[cid].add(uid);
  };

  const [miembrosRows, divisionesRows, equiposRows, clubsAdmin] = await Promise.all([
    ClubMiembros.findAll({
      where: { club_id: { [Op.in]: ids }, estado: 'ACTIVO' },
      attributes: ['club_id', 'usuario_id'],
    }),
    ClubDivisiones.findAll({
      where: { club_id: { [Op.in]: ids } },
      attributes: ['id', 'club_id'],
      include: [{
        model: ClubDivisionAtletas,
        as: 'atletas',
        attributes: ['usuario_id', 'estado'],
        required: false,
      }],
    }),
    Team.findAll({
      where: { club_id: { [Op.in]: ids } },
      attributes: ['id', 'club_id'],
    }),
    Clubs.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'admin_id'],
    }),
  ]);

  miembrosRows.forEach((row) => addUsuario(row.club_id, row.usuario_id));

  divisionesRows.forEach((division) => {
    for (const atleta of division.atletas ?? []) {
      if (atleta.estado === 'INACTIVO') continue;
      addUsuario(division.club_id, atleta.usuario_id);
    }
  });

  clubsAdmin.forEach((club) => addUsuario(club.id, club.admin_id));

  if (equiposRows.length) {
    const clubPorEquipo = Object.fromEntries(
      equiposRows.map((equipo) => [equipo.id, equipo.club_id]),
    );
    const planteles = await TeamMiembros.findAll({
      where: {
        team_id: { [Op.in]: equiposRows.map((equipo) => equipo.id) },
        estado_invitacion: 'ACEPTADO',
      },
      attributes: ['team_id', 'user_id'],
    });
    planteles.forEach((row) => {
      const clubId = clubPorEquipo[row.team_id];
      if (clubId) addUsuario(clubId, row.user_id);
    });
  }

  ids.forEach((id) => {
    counts[id] = sets[id].size;
  });
  return counts;
};

export const listarClubesUsuario = async (userId) => {
  const [comoAdmin, divisionesEncargadas, membresias, equiposEnClub] = await Promise.all([
    Clubs.findAll({
      where: { admin_id: userId },
      include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
      order: [['nombre', 'ASC']],
    }),
    ClubDivisiones.findAll({
      where: { encargado_id: userId },
      attributes: ['club_id'],
    }),
    ClubMiembros.findAll({
      where: { usuario_id: userId, estado: 'ACTIVO' },
      attributes: ['club_id'],
    }),
    TeamMiembros.findAll({
      where: { user_id: userId, estado_invitacion: 'ACEPTADO' },
      include: [{
        model: Team,
        as: 'equipo',
        attributes: ['id', 'club_id'],
        where: { club_id: { [Op.ne]: null } },
        required: true,
      }],
    }),
  ]);

  const idsAdmin = new Set(comoAdmin.map((c) => c.id));
  const idsEncargado = divisionesEncargadas
    .map((d) => d.club_id)
    .filter((id) => !idsAdmin.has(id));

  let comoEncargado = [];
  if (idsEncargado.length > 0) {
    comoEncargado = await Clubs.findAll({
      where: { id: idsEncargado },
      include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
      order: [['nombre', 'ASC']],
    });
  }

  const idsGestion = new Set([...idsAdmin, ...idsEncargado]);
  const idsParticipo = new Set();

  membresias.forEach((m) => {
    if (!idsGestion.has(m.club_id)) idsParticipo.add(m.club_id);
  });
  equiposEnClub.forEach((tm) => {
    if (tm.equipo?.club_id && !idsGestion.has(tm.equipo.club_id)) {
      idsParticipo.add(tm.equipo.club_id);
    }
  });

  let participo = [];
  if (idsParticipo.size > 0) {
    participo = await Clubs.findAll({
      where: { id: [...idsParticipo] },
      include: [{ model: Sports, as: 'sport', attributes: ['id', 'name'] }],
      order: [['nombre', 'ASC']],
    });
  }

  const allClubIds = [
    ...comoAdmin.map((club) => club.id),
    ...comoEncargado.map((club) => club.id),
    ...participo.map((club) => club.id),
  ];
  const miembrosCounts = await contarMiembrosActivosPorClubIds(allClubIds);

  return {
    administrados: comoAdmin.map((club) => serializarClubResumen(club, miembrosCounts[club.id] ?? 0)),
    encargados: comoEncargado.map((club) => serializarClubResumen(club, miembrosCounts[club.id] ?? 0)),
    participo: participo.map((club) => serializarClubResumen(club, miembrosCounts[club.id] ?? 0)),
  };
};

const serializarClubResumen = (club, miembrosCount = 0) => {
  const json = typeof club.toJSON === 'function' ? club.toJSON() : club;
  return {
    id: json.id,
    nombre: json.nombre,
    logo_url: json.logo_url,
    ubicacion: json.ubicacion,
    sport: json.sport ?? null,
    miembros_count: miembrosCount,
  };
};

export const serializarDivision = (division) => {
  const json = typeof division.toJSON === 'function' ? division.toJSON() : division;
  return {
    id: json.id,
    nombre: json.nombre,
    genero: json.genero,
    categoria_edad: json.categoria_edad ?? null,
    edad_minima: json.edad_minima ?? null,
    edad_maxima: json.edad_maxima ?? null,
    encargado: json.encargado ? mapUserForClient(json.encargado) : null,
    equipos_count: json.equipos?.length ?? json.equipos_count ?? 0,
  };
};

export const serializarEquipoClub = (equipo) => {
  const json = typeof equipo.toJSON === 'function' ? equipo.toJSON() : equipo;
  return {
    id: json.id,
    name: json.name,
    logo_url: json.logo_url,
    capitan_id: json.capitan_id,
    genero: json.genero ?? null,
    categoria_edad: json.categoria_edad ?? null,
    capitan: json.capitan ? mapUserForClient(json.capitan) : null,
    club_division_id: json.club_division_id ?? null,
    division: json.clubDivision
      ? { id: json.clubDivision.id, nombre: json.clubDivision.nombre }
      : null,
  };
};

export const obtenerPerfilPublicoClub = async (clubId, viewerId) => {
  const club = await Clubs.findByPk(clubId, {
    include: [
      { model: Sports, as: 'sport', attributes: ['id', 'name'] },
      { model: User, as: 'admin', attributes: ['id', 'nick', 'name', 'photo', 'foto_portada_url'] },
      {
        model: ClubDivisiones,
        as: 'divisiones',
        include: [
          { model: User, as: 'encargado', attributes: ['id', 'nick', 'name', 'photo', 'foto_portada_url'] },
          {
            model: Team,
            as: 'equipos',
            attributes: ['id', 'name', 'logo_url', 'capitan_id', 'club_division_id', 'genero', 'categoria_edad'],
            include: [
              { model: User, as: 'capitan', attributes: ['id', 'nick', 'name', 'photo', 'foto_portada_url'] },
            ],
          },
        ],
      },
    ],
  });

  if (!club) return null;

  const permisos = await usuarioPuedeGestionarClub(clubId, viewerId);
  const esAdmin = usuarioEsAdminClub(club, viewerId);

  const divisiones = (club.divisiones ?? []).map((div) => ({
    ...serializarDivision(div),
    equipos: (div.equipos ?? []).map(serializarEquipoClub),
  }));

  const divisionIds = (club.divisiones ?? []).map((d) => d.id);
  const jugadoresCount = divisionIds.length > 0
    ? await ClubDivisionAtletas.count({
      where: {
        club_division_id: { [Op.in]: divisionIds },
        estado: { [Op.ne]: 'INACTIVO' },
      },
    })
    : 0;

  const entrenadorIds = new Set(
    (club.divisiones ?? [])
      .map((div) => div.encargado_id ?? club.admin_id)
      .filter(Boolean),
  );

  const torneosOrganizados = await Torneos.count({
    where: { club_organizador_id: clubId },
  });

  const publicacionAviso = await obtenerPermisosPublicacionAviso(clubId, viewerId, club);

  const miAtletaRow = viewerId && divisionIds.length > 0
    ? await ClubDivisionAtletas.findOne({
      where: {
        usuario_id: viewerId,
        club_division_id: { [Op.in]: divisionIds },
        estado: { [Op.ne]: 'INACTIVO' },
      },
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id', 'nick', 'name', 'photo', 'foto_portada_url'],
        },
        {
          model: ClubDivisiones,
          as: 'division',
          attributes: ['id', 'nombre', 'club_id'],
        },
      ],
      order: [['id', 'ASC']],
    })
    : null;

  const miAtleta = miAtletaRow
    ? {
      id: miAtletaRow.id,
      club_division_id: miAtletaRow.club_division_id,
      usuario_id: miAtletaRow.usuario_id,
      dorsal: miAtletaRow.dorsal ?? null,
      posicion: miAtletaRow.posicion ?? null,
      estado: miAtletaRow.estado,
      fecha_ingreso: miAtletaRow.fecha_ingreso,
      usuario: miAtletaRow.usuario ? mapUserForClient(miAtletaRow.usuario) : null,
      division: miAtletaRow.division
        ? { id: miAtletaRow.division.id, nombre: miAtletaRow.division.nombre }
        : null,
    }
    : null;

  return {
    club: {
      id: club.id,
      nombre: club.nombre,
      logo_url: club.logo_url,
      descripcion: club.descripcion,
      ubicacion: club.ubicacion,
      sport: club.sport ? { id: club.sport.id, name: club.sport.name } : null,
      admin: club.admin ? mapUserForClient(club.admin) : null,
      creado_at: club.creado_at,
    },
    divisiones,
    contadores: {
      divisiones: divisiones.length,
      equipos: divisiones.reduce((acc, d) => acc + (d.equipos?.length ?? 0), 0),
      entrenadores: entrenadorIds.size,
      jugadores: jugadoresCount,
      torneos: torneosOrganizados,
    },
    permisos: {
      es_admin: esAdmin,
      puede_gestionar: permisos.puede,
      // Solo estas divisiones pueden usarse para programar/gestionar entrenamientos.
      division_ids_gestionables: permisos.divisionIdsGestionables ?? [],
      publicacion_aviso: publicacionAviso,
    },
    mi_atleta: miAtleta,
  };
};

export const validarDivisionPerteneceClub = async (clubId, divisionId) => {
  if (!divisionId) {
    return { ok: false, error: 'club_division_id es obligatorio' };
  }
  const division = await ClubDivisiones.findOne({
    where: { id: divisionId, club_id: clubId },
  });
  if (!division) {
    return { ok: false, error: 'La división no pertenece a este club' };
  }
  return { ok: true, division };
};

export const validarEquipoParaClub = async (equipoId, club) => {
  const equipo = await Team.findByPk(equipoId, {
    attributes: ['id', 'name', 'sport_id', 'capitan_id', 'club_id', 'club_division_id'],
  });

  if (!equipo) {
    return { ok: false, status: 404, error: 'Equipo no encontrado' };
  }

  if (equipo.club_id != null) {
    return { ok: false, status: 409, error: 'El equipo ya pertenece a un club' };
  }

  if (equipo.sport_id !== club.sport_id) {
    return { ok: false, status: 400, error: 'El deporte del equipo no coincide con el del club' };
  }

  return { ok: true, equipo };
};

export { parseId };
