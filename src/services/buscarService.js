import { Op } from 'sequelize';
import {
  User,
  Team,
  TeamMiembros,
  Torneos,
  Sports,
  Complejos,
  TorneoInscripcion,
} from '../db/db.js';
import {
  obtenerEquiposDestacados,
  obtenerUsuariosDestacados,
  obtenerPublicacionesRecientes,
} from './destacadosService.js';

const LIMITE = 5;
const LIMITE_DESCUBRIR = 8;

const includeTorneo = [
  { model: Sports, as: 'sport', attributes: ['id', 'name'] },
  { model: Complejos, as: 'complejo', attributes: ['id', 'nombre', 'ubicacion'] }
];

const includeEquipo = [
  { model: Sports, as: 'sport', attributes: ['id', 'name'] }
];

const enriquecerTorneos = async (torneos) => {
  if (!torneos.length) return [];

  const torneoIds = torneos.map((t) => t.id);
  const inscripciones = await TorneoInscripcion.findAll({
    where: { torneo_id: { [Op.in]: torneoIds }, estado: 'ACEPTADA' },
    attributes: ['torneo_id']
  });

  const equiposPorTorneo = {};
  inscripciones.forEach((ins) => {
    equiposPorTorneo[ins.torneo_id] = (equiposPorTorneo[ins.torneo_id] || 0) + 1;
  });

  return torneos.map((torneo) => {
    const json = torneo.toJSON();
    return {
      id: json.id,
      nombre: json.nombre,
      photo: json.imagen_portada_url ?? json.photo ?? null,
      estado: json.estado,
      visibilidad: json.visibilidad,
      modalidad: json.modalidad,
      max_equipos: json.max_equipos,
      fecha_inicio: json.fecha_hora_inicio ?? json.fecha_inicio ?? null,
      creado_at: json.creado_at,
      sport: json.sport ?? null,
      complejo: json.complejo ?? null,
      equipos_inscritos: equiposPorTorneo[json.id] || 0
    };
  });
};

export const buscarPersonas = async (query, userId, limite = LIMITE) => {
  const q = query.trim();
  if (!q) return [];

  const usuarios = await User.findAll({
    where: {
      id: { [Op.ne]: userId },
      [Op.or]: [
        { nick: { [Op.iLike]: `%${q}%` } },
        { name: { [Op.iLike]: `%${q}%` } }
      ]
    },
    attributes: ['id', 'nick', 'name', 'photo'],
    order: [['nick', 'ASC']],
    limit: limite
  });

  return usuarios.map((u) => u.toJSON());
};

export const buscarEquipos = async (query, limite = LIMITE) => {
  const q = query.trim();
  if (!q) return [];

  const equipos = await Team.findAll({
    where: {
      name: { [Op.iLike]: `%${q}%` },
      [Op.or]: [{ privado: false }, { privado: null }]
    },
    include: includeEquipo,
    order: [['name', 'ASC']],
    limit: limite
  });

  const ids = equipos.map((e) => e.id);
  const conteos = ids.length
    ? await TeamMiembros.findAll({
        where: { team_id: { [Op.in]: ids }, estado_invitacion: 'ACEPTADO' },
        attributes: ['team_id']
      })
    : [];

  const miembrosPorEquipo = {};
  conteos.forEach((m) => {
    miembrosPorEquipo[m.team_id] = (miembrosPorEquipo[m.team_id] || 0) + 1;
  });

  return equipos.map((equipo) => {
    const json = equipo.toJSON();
    return {
      id: json.id,
      name: json.name,
      logo_url: json.logo_url,
      sport: json.sport ?? null,
      miembros_count: miembrosPorEquipo[json.id] || 0
    };
  });
};

export const buscarTorneos = async (query, limite = LIMITE) => {
  const q = query.trim();
  if (!q) return [];

  const torneos = await Torneos.findAll({
    where: {
      visibilidad: 'PUBLICO',
      nombre: { [Op.iLike]: `%${q}%` }
    },
    include: includeTorneo,
    order: [['creado_at', 'DESC']],
    limit: limite
  });

  return enriquecerTorneos(torneos);
};

export const obtenerTorneosDescubrir = async (limite = LIMITE_DESCUBRIR) => {
  const torneos = await Torneos.findAll({
    where: {
      visibilidad: 'PUBLICO',
      estado: { [Op.in]: ['PLANEACION', 'INSCRIPCIONES', 'EN_CURSO'] }
    },
    include: includeTorneo,
    order: [['creado_at', 'DESC']],
    limit: limite * 2
  });

  const enriquecidos = await enriquecerTorneos(torneos);
  enriquecidos.sort((a, b) => (b.equipos_inscritos || 0) - (a.equipos_inscritos || 0));
  return enriquecidos.slice(0, limite);
};

const TIPOS_VALIDOS = new Set(['todo', 'personas', 'equipos', 'torneos']);

export const buscarGlobal = async ({ query, tipo, userId }) => {
  const q = (query || '').trim();
  const tipoNormalizado = TIPOS_VALIDOS.has(tipo) ? tipo : 'todo';

  if (!q) {
    const incluirPersonas = tipoNormalizado === 'todo' || tipoNormalizado === 'personas';
    const incluirEquipos = tipoNormalizado === 'todo' || tipoNormalizado === 'equipos';
    const incluirTorneos = tipoNormalizado === 'todo' || tipoNormalizado === 'torneos';
    const incluirPublicaciones = tipoNormalizado === 'todo';

    const [personas, equipos, torneos, publicaciones] = await Promise.all([
      incluirPersonas ? obtenerUsuariosDestacados(userId, LIMITE_DESCUBRIR) : Promise.resolve([]),
      incluirEquipos ? obtenerEquiposDestacados(LIMITE_DESCUBRIR) : Promise.resolve([]),
      incluirTorneos ? obtenerTorneosDescubrir() : Promise.resolve([]),
      incluirPublicaciones ? obtenerPublicacionesRecientes(LIMITE_DESCUBRIR) : Promise.resolve([]),
    ]);

    return { personas, equipos, torneos, publicaciones, descubrir: true };
  }

  const incluirPersonas = tipoNormalizado === 'todo' || tipoNormalizado === 'personas';
  const incluirEquipos = tipoNormalizado === 'todo' || tipoNormalizado === 'equipos';
  const incluirTorneos = tipoNormalizado === 'todo' || tipoNormalizado === 'torneos';

  const [personas, equipos, torneos] = await Promise.all([
    incluirPersonas ? buscarPersonas(q, userId) : Promise.resolve([]),
    incluirEquipos ? buscarEquipos(q) : Promise.resolve([]),
    incluirTorneos ? buscarTorneos(q) : Promise.resolve([])
  ]);

  return { personas, equipos, torneos, publicaciones: [], descubrir: false };
};
