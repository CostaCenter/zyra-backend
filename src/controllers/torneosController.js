import { Op, UniqueConstraintError } from 'sequelize';
import {
  Torneos,
  FaseTorneo,
  GrupoDivision,
  GrupoEquipos,
  TorneoInscripcion,
  TorneoArbitros,
  Sports,
  Complejos,
  Partidos,
  PartidoParticipantes,
  Team,
  TeamMiembros,
  User
} from '../db/db.js';
import {
  generarRoundRobin,
  generarEliminacionDirecta,
  generarGruposEliminatorias,
  generarEliminatoriasDesdeGrupos,
} from '../services/generadorFixture.js';
import { calcularPosicionesTorneo } from '../services/calcularPosicionesTorneo.js';
import { obtenerPerfilPublicoTorneo } from '../services/torneoPerfilService.js';
import { obtenerEstadoHorarioTorneo } from '../services/recalculoHorariosService.js';
import {
  parsearConfigTorneoBody,
  parseReglasArbitrajeBody,
  REGLAS_ARBITRAJE_DEFAULT,
  validarConfigGruposEliminatorias,
  TIPOS_FORMATO_FASE,
} from '../services/torneoConfigService.js';
import {
  subirImagenPerfil,
  formatearErrorCloudinary,
} from '../services/cloudinaryService.js';

const TIPOS_FORMATO_VALIDOS = TIPOS_FORMATO_FASE;
const VISIBILIDADES_VALIDAS = ['PUBLICO', 'PRIVADO'];
const CODIGO_ACCESO_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODIGO_ACCESO_REGEX = /^[A-Z0-9]{4,10}$/;
const MAX_INTENTOS_CODIGO = 5;

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const generarCodigoAcceso = () => {
  let codigo = '';
  for (let i = 0; i < 6; i += 1) {
    const idx = Math.floor(Math.random() * CODIGO_ACCESO_CHARS.length);
    codigo += CODIGO_ACCESO_CHARS[idx];
  }
  return codigo;
};

const generarCodigoAccesoUnico = async () => {
  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const codigo = generarCodigoAcceso();
    const existente = await Torneos.findOne({
      where: { codigo_acceso: codigo },
      attributes: ['id']
    });
    if (!existente) {
      return codigo;
    }
  }
  return null;
};

const normalizarCodigoAcceso = (codigo) => codigo.trim().toUpperCase();

const resolverCodigoAccesoPrivado = async (codigoAccesoBody) => {
  if (codigoAccesoBody !== undefined && codigoAccesoBody !== null && String(codigoAccesoBody).trim() !== '') {
    const codigoNormalizado = normalizarCodigoAcceso(String(codigoAccesoBody));

    if (!CODIGO_ACCESO_REGEX.test(codigoNormalizado)) {
      return {
        error: {
          status: 400,
          message: 'codigo_acceso debe tener entre 4 y 10 caracteres alfanuméricos (A-Z, 0-9)'
        }
      };
    }

    const existente = await Torneos.findOne({
      where: { codigo_acceso: codigoNormalizado },
      attributes: ['id']
    });

    if (existente) {
      return {
        error: {
          status: 409,
          message: 'Ese código ya está en uso, elige otro'
        }
      };
    }

    return { codigo: codigoNormalizado };
  }

  const codigoGenerado = await generarCodigoAccesoUnico();
  if (!codigoGenerado) {
    return {
      error: {
        status: 500,
        message: 'No se pudo generar un código de acceso único'
      }
    };
  }

  return { codigo: codigoGenerado };
};

const aplicarFiltroVisibilidadListado = (where, query, userId) => {
  const creadoPorFilter = parseId(query.creado_por_user_id);

  if (creadoPorFilter === userId) {
    return where;
  }

  where.visibilidad = 'PUBLICO';
  return where;
};

const includeTorneo = [
  { model: Sports, as: 'sport', attributes: ['id', 'name'] },
  { model: Complejos, as: 'complejo', attributes: ['id', 'nombre', 'ubicacion'] }
];

const includeTorneoCompleto = [
  ...includeTorneo,
  {
    model: FaseTorneo,
    as: 'fases',
    include: [{
      model: GrupoDivision,
      as: 'grupos',
      include: [{
        model: GrupoEquipos,
        as: 'equipos',
        include: [{
          model: Team,
          as: 'equipo',
          attributes: ['id', 'name', 'logo_url'],
        }],
      }],
    }],
  }
];

const buildTorneosWhere = (query) => {
  const where = {};

  if (query.sport_id) {
    where.sport_id = parseInt(query.sport_id, 10);
  }
  if (query.complejo_id) {
    where.complejo_id = parseInt(query.complejo_id, 10);
  }
  if (query.estado) {
    where.estado = query.estado;
  }
  if (query.creado_por_user_id) {
    where.creado_por_user_id = parseInt(query.creado_por_user_id, 10);
  }

  return where;
};

const textoOpcional = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

const parseFechaOpcional = (value) => {
  if (value === undefined || value === null || value === '') return { value: undefined };
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) {
    return { error: 'fecha_hora_inicio no es una fecha válida' };
  }
  return { value: fecha };
};

const formatTorneo = (torneo) => torneo.toJSON();

const enriquecerTorneosParaListado = async (torneos) => {
  if (torneos.length === 0) {
    return [];
  }

  const torneoIds = torneos.map((torneo) => torneo.id);

  const [inscripciones, fases] = await Promise.all([
    TorneoInscripcion.findAll({
      where: {
        torneo_id: { [Op.in]: torneoIds },
        estado: 'ACEPTADA'
      },
      attributes: ['torneo_id']
    }),
    FaseTorneo.findAll({
      where: { torneo_id: { [Op.in]: torneoIds } },
      attributes: ['torneo_id', 'tipo_formato', 'orden'],
      order: [['torneo_id', 'ASC'], ['orden', 'ASC']]
    })
  ]);

  const equiposPorTorneo = {};
  inscripciones.forEach((inscripcion) => {
    equiposPorTorneo[inscripcion.torneo_id] =
      (equiposPorTorneo[inscripcion.torneo_id] || 0) + 1;
  });

  const formatoPorTorneo = {};
  const numFasesPorTorneo = {};

  fases.forEach((fase) => {
    if (!numFasesPorTorneo[fase.torneo_id]) {
      numFasesPorTorneo[fase.torneo_id] = 0;
    }
    numFasesPorTorneo[fase.torneo_id] += 1;

    if (!formatoPorTorneo[fase.torneo_id]) {
      formatoPorTorneo[fase.torneo_id] = fase.tipo_formato;
    }
  });

  return torneos.map((torneo) => {
    const json = formatTorneo(torneo);
    const numFases = numFasesPorTorneo[json.id] || 0;

    return {
      ...json,
      equipos_inscritos: equiposPorTorneo[json.id] || 0,
      num_fases: numFases,
      tipo_formato: numFases === 1 ? formatoPorTorneo[json.id] || null : null,
      fecha_inicio: json.fecha_hora_inicio ?? json.fecha_inicio ?? null
    };
  });
};

/**
 * GET /api/torneos
 * Lista torneos con filtros opcionales por query params.
 */
export const listTorneos = async (req, res) => {
  try {
    const where = buildTorneosWhere(req.query);
    aplicarFiltroVisibilidadListado(where, req.query, req.userId);

    const torneos = await Torneos.findAll({
      where,
      include: includeTorneo,
      order: [['creado_at', 'DESC']]
    });

    const data = await enriquecerTorneosParaListado(torneos);

    return res.status(200).json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    console.error('Error en listTorneos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener torneos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/torneos/mios
 * Torneos creados por el usuario autenticado.
 */
export const getMisTorneos = async (req, res) => {
  try {
    const torneos = await Torneos.findAll({
      where: { creado_por_user_id: req.userId },
      include: includeTorneo,
      order: [['creado_at', 'DESC']]
    });

    const data = await enriquecerTorneosParaListado(torneos);

    return res.status(200).json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    console.error('Error en getMisTorneos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener tus torneos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/torneos/inscritos
 * Torneos con inscripción ACEPTADA en un equipo donde el usuario es miembro activo.
 */
export const getTorneosInscritos = async (req, res) => {
  try {
    const inscripciones = await TorneoInscripcion.findAll({
      attributes: ['torneo_id'],
      where: { estado: 'ACEPTADA' },
      include: [
        {
          model: Team,
          as: 'equipo',
          required: true,
          attributes: [],
          include: [
            {
              model: TeamMiembros,
              as: 'miembros',
              required: true,
              attributes: [],
              where: {
                user_id: req.userId,
                estado_invitacion: 'ACEPTADO'
              }
            }
          ]
        }
      ]
    });

    const torneoIds = [...new Set(inscripciones.map((inscripcion) => inscripcion.torneo_id))];

    if (torneoIds.length === 0) {
      return res.status(200).json({ success: true, total: 0, data: [] });
    }

    const torneos = await Torneos.findAll({
      where: { id: { [Op.in]: torneoIds } },
      include: includeTorneo,
      order: [['creado_at', 'DESC']]
    });

    const data = await enriquecerTorneosParaListado(torneos);

    return res.status(200).json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    console.error('Error en getTorneosInscritos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener torneos inscritos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/torneos
 */
export const createTorneo = async (req, res) => {
  try {
    const {
      nombre,
      sport_id,
      complejo_id,
      club_organizador_id,
      nivel_arbitraje_default,
      reglas_arbitraje_json,
      modalidad,
      visibilidad,
      codigo_acceso,
      max_equipos,
      fecha_hora_inicio,
      lugar,
      costo_inscripcion,
      premiacion
    } = req.body;

    const visibilidadTorneo = visibilidad ?? 'PUBLICO';
    if (!VISIBILIDADES_VALIDAS.includes(visibilidadTorneo)) {
      return res.status(400).json({
        success: false,
        message: 'visibilidad debe ser PUBLICO o PRIVADO'
      });
    }

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({
        success: false,
        message: 'nombre es obligatorio'
      });
    }

    const sportId = parseId(sport_id);
    if (!sportId) {
      return res.status(400).json({
        success: false,
        message: 'sport_id es obligatorio y debe ser un número válido'
      });
    }

    const sport = await Sports.findByPk(sportId, { attributes: ['id', 'name'] });
    if (!sport) {
      return res.status(404).json({
        success: false,
        message: 'Deporte no encontrado'
      });
    }

    let complejoId = null;
    if (complejo_id !== undefined && complejo_id !== null) {
      complejoId = parseId(complejo_id);
      if (!complejoId) {
        return res.status(400).json({
          success: false,
          message: 'complejo_id debe ser un número válido'
        });
      }

      const complejo = await Complejos.findByPk(complejoId, { attributes: ['id'] });
      if (!complejo) {
        return res.status(404).json({
          success: false,
          message: 'Complejo no encontrado'
        });
      }
    }

    const payload = {
      nombre: nombre.trim(),
      sport_id: sportId,
      complejo_id: complejoId,
      creado_por_user_id: req.userId,
      nivel_arbitraje_default: nivel_arbitraje_default ?? 'BASICO',
      reglas_arbitraje_json: reglas_arbitraje_json ?? {},
      visibilidad: visibilidadTorneo
    };

    if (visibilidadTorneo === 'PRIVADO') {
      const resultadoCodigo = await resolverCodigoAccesoPrivado(codigo_acceso);
      if (resultadoCodigo.error) {
        return res.status(resultadoCodigo.error.status).json({
          success: false,
          message: resultadoCodigo.error.message
        });
      }
      payload.codigo_acceso = resultadoCodigo.codigo;
    }

    if (club_organizador_id !== undefined && club_organizador_id !== null) {
      payload.club_organizador_id = club_organizador_id;
    }
    if (modalidad !== undefined) {
      payload.modalidad = modalidad;
    }

    if (max_equipos !== undefined && max_equipos !== null) {
      const maxEquipos = parseId(max_equipos);
      if (!maxEquipos || maxEquipos < 2) {
        return res.status(400).json({
          success: false,
          message: 'max_equipos debe ser un entero mayor o igual a 2'
        });
      }
      payload.max_equipos = maxEquipos;
    }

    const fechaInicio = parseFechaOpcional(fecha_hora_inicio);
    if (fechaInicio.error) {
      return res.status(400).json({
        success: false,
        message: fechaInicio.error
      });
    }
    if (fechaInicio.value !== undefined) {
      payload.fecha_hora_inicio = fechaInicio.value;
    }

    const lugarTexto = textoOpcional(lugar);
    if (lugarTexto !== undefined) payload.lugar = lugarTexto;

    const costoTexto = textoOpcional(costo_inscripcion);
    if (costoTexto !== undefined) payload.costo_inscripcion = costoTexto;

    const premiacionTexto = textoOpcional(premiacion);
    if (premiacionTexto !== undefined) payload.premiacion = premiacionTexto;

    const configParsed = parsearConfigTorneoBody(req.body);
    if (configParsed.errors.length) {
      return res.status(400).json({
        success: false,
        message: configParsed.errors.join('; '),
      });
    }
    Object.assign(payload, configParsed.updates);

    const torneo = await Torneos.create(payload);

    await TorneoArbitros.create({
      torneo_id: torneo.id,
      usuario_id: req.userId,
      estado_confirmacion: 'CONFIRMADO',
    });

    const torneoConRelaciones = await Torneos.findByPk(torneo.id, {
      include: includeTorneo
    });

    return res.status(201).json({
      success: true,
      message: 'Torneo creado',
      data: torneoConRelaciones.toJSON()
    });
  } catch (error) {
    console.error('Error en createTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear torneo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/torneos/:torneo_id
 * Actualiza datos del torneo (solo organizador).
 */
export const updateTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    if (!torneoId) {
      return res.status(400).json({ success: false, message: 'torneo_id inválido' });
    }

    const torneo = await Torneos.findByPk(torneoId);
    if (!torneo) {
      return res.status(404).json({ success: false, message: 'Torneo no encontrado' });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el organizador puede editar este torneo',
      });
    }

    const {
      nombre,
      sport_id,
      visibilidad,
      max_equipos,
      fecha_hora_inicio,
      lugar,
      costo_inscripcion,
      premiacion,
      tipo_formato,
    } = req.body;

    const updates = {};

    if (nombre !== undefined) {
      if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ success: false, message: 'nombre es obligatorio' });
      }
      updates.nombre = nombre.trim();
    }

    if (sport_id !== undefined) {
      const sportId = parseId(sport_id);
      if (!sportId) {
        return res.status(400).json({
          success: false,
          message: 'sport_id debe ser un número válido',
        });
      }

      if (sportId !== torneo.sport_id) {
        const aceptados = await TorneoInscripcion.count({
          where: { torneo_id: torneoId, estado: 'ACEPTADA' },
        });
        if (aceptados > 0) {
          return res.status(400).json({
            success: false,
            message: 'No se puede cambiar el deporte si ya hay equipos inscritos',
          });
        }
      }

      const sport = await Sports.findByPk(sportId, { attributes: ['id'] });
      if (!sport) {
        return res.status(404).json({ success: false, message: 'Deporte no encontrado' });
      }
      updates.sport_id = sportId;
    }

    if (visibilidad !== undefined) {
      if (!VISIBILIDADES_VALIDAS.includes(visibilidad)) {
        return res.status(400).json({
          success: false,
          message: 'visibilidad debe ser PUBLICO o PRIVADO',
        });
      }
      updates.visibilidad = visibilidad;
      if (visibilidad === 'PRIVADO' && !torneo.codigo_acceso) {
        const resultadoCodigo = await resolverCodigoAccesoPrivado(req.body.codigo_acceso);
        if (resultadoCodigo.error) {
          return res.status(resultadoCodigo.error.status).json({
            success: false,
            message: resultadoCodigo.error.message,
          });
        }
        updates.codigo_acceso = resultadoCodigo.codigo;
      }
    }

    if (max_equipos !== undefined) {
      if (max_equipos === null || max_equipos === '') {
        updates.max_equipos = null;
      } else {
        const maxEquipos = parseId(max_equipos);
        if (!maxEquipos || maxEquipos < 2) {
          return res.status(400).json({
            success: false,
            message: 'max_equipos debe ser un entero mayor o igual a 2',
          });
        }
        updates.max_equipos = maxEquipos;
      }
    }

    if (fecha_hora_inicio !== undefined) {
      const fechaInicio = parseFechaOpcional(fecha_hora_inicio);
      if (fechaInicio.error) {
        return res.status(400).json({ success: false, message: fechaInicio.error });
      }
      updates.fecha_hora_inicio = fechaInicio.value === undefined ? null : fechaInicio.value;
    }

    if (lugar !== undefined) {
      const lugarTexto = textoOpcional(lugar);
      updates.lugar = lugarTexto === undefined ? null : lugarTexto;
    }

    if (costo_inscripcion !== undefined) {
      const costoTexto = textoOpcional(costo_inscripcion);
      updates.costo_inscripcion = costoTexto === undefined ? null : costoTexto;
    }

    if (premiacion !== undefined) {
      const premiacionTexto = textoOpcional(premiacion);
      updates.premiacion = premiacionTexto === undefined ? null : premiacionTexto;
    }

    if (Object.keys(updates).length > 0) {
      await torneo.update(updates);
    }

    const configParsed = parsearConfigTorneoBody(req.body);
    if (configParsed.errors.length) {
      return res.status(400).json({
        success: false,
        message: configParsed.errors.join('; '),
      });
    }
    if (Object.keys(configParsed.updates).length) {
      await torneo.update(configParsed.updates);
    }

    const reglasParsed = parseReglasArbitrajeBody(req.body);
    if (reglasParsed.errors.length) {
      return res.status(400).json({
        success: false,
        message: reglasParsed.errors.join('; '),
      });
    }
    if (Object.keys(reglasParsed.reglas).length) {
      const actuales = torneo.reglas_arbitraje_json ?? {};
      await torneo.update({
        reglas_arbitraje_json: {
          ...REGLAS_ARBITRAJE_DEFAULT,
          ...actuales,
          ...reglasParsed.reglas,
        },
      });
    }

    if (tipo_formato && TIPOS_FORMATO_VALIDOS.includes(tipo_formato)) {
      const fases = await FaseTorneo.findAll({
        where: { torneo_id: torneoId },
        order: [['orden', 'ASC']],
      });

      if (fases.length === 0) {
        await FaseTorneo.create({
          torneo_id: torneoId,
          orden: 1,
          tipo_formato,
          nombre: 'Fase 1',
        });
      } else if (fases.length === 1 && fases[0].tipo_formato !== tipo_formato) {
        const partidosFase = await Partidos.count({
          where: { fase_torneo_id: fases[0].id },
        });
        if (partidosFase === 0) {
          await fases[0].update({ tipo_formato });
        }
      }
    }

    const actualizado = await Torneos.findByPk(torneoId, { include: includeTorneo });
    const [enriquecido] = await enriquecerTorneosParaListado([actualizado]);

    return res.status(200).json({
      success: true,
      message: 'Torneo actualizado',
      data: enriquecido,
    });
  } catch (error) {
    console.error('Error en updateTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar torneo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/torneos/:torneo_id/photo
 * Sube foto de perfil del torneo (solo organizador).
 */
export const updateTorneoPhoto = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    if (!torneoId) {
      return res.status(400).json({ success: false, message: 'torneo_id inválido' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'La imagen photo es obligatoria' });
    }

    const torneo = await Torneos.findByPk(torneoId, { attributes: ['id', 'creado_por_user_id'] });
    if (!torneo) {
      return res.status(404).json({ success: false, message: 'Torneo no encontrado' });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el organizador puede cambiar la foto del torneo',
      });
    }

    const upload = await subirImagenPerfil(req.file, 'torneos');
    await torneo.update({
      photo: upload.secure_url,
      imagen_portada_url: upload.secure_url,
    });

    const actualizado = await Torneos.findByPk(torneoId, { include: includeTorneo });
    const [enriquecido] = await enriquecerTorneosParaListado([actualizado]);

    return res.status(200).json({
      success: true,
      message: 'Foto del torneo actualizada',
      data: enriquecido,
    });
  } catch (error) {
    console.error('Error en updateTorneoPhoto:', error);
    return res.status(500).json({
      success: false,
      message: formatearErrorCloudinary(error) || 'Error al subir foto del torneo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/torneos/buscar-por-codigo/:codigo
 */
export const buscarTorneoPorCodigo = async (req, res) => {
  try {
    const codigo = req.params.codigo?.trim().toUpperCase();

    if (!codigo) {
      return res.status(400).json({
        success: false,
        message: 'codigo es obligatorio'
      });
    }

    const torneo = await Torneos.findOne({
      where: { codigo_acceso: codigo },
      include: includeTorneoCompleto,
      order: [[{ model: FaseTorneo, as: 'fases' }, 'orden', 'ASC']]
    });

    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    return res.status(200).json({
      success: true,
      data: torneo.toJSON()
    });
  } catch (error) {
    console.error('Error en buscarTorneoPorCodigo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al buscar torneo por código',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/torneos/:torneo_id
 */
export const getTorneoById = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    if (!torneoId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id inválido'
      });
    }

    const torneo = await Torneos.findByPk(torneoId, {
      include: includeTorneoCompleto,
      order: [[{ model: FaseTorneo, as: 'fases' }, 'orden', 'ASC']]
    });

    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    const json = torneo.toJSON();
    const equiposInscritos = await TorneoInscripcion.count({
      where: { torneo_id: torneoId, estado: 'ACEPTADA' }
    });
    const numFases = json.fases?.length ?? 0;
    const esOrganizador = json.creado_por_user_id === req.userId;

    let partidos = [];
    let misInscripciones = [];

    if (esOrganizador) {
      const partidosTorneo = await Partidos.findAll({
        where: { torneo_id: torneoId },
        include: [
          {
            model: User,
            as: 'arbitro',
            attributes: ['id', 'nick', 'name'],
            required: false
          },
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
        order: [['id', 'ASC']]
      });
      partidos = partidosTorneo.map((partido) => {
        const json = partido.toJSON();
        const participantes = json.participantes ?? [];
        const local = participantes.find((p) => p.es_local === true);
        const visitante = participantes.find((p) => p.es_local === false);

        return {
          ...json,
          equipo_local_id: local?.team_id ?? null,
          equipo_local_nombre: local?.equipo?.name ?? null,
          equipo_visitante_id: visitante?.team_id ?? null,
          equipo_visitante_nombre: visitante?.equipo?.name ?? null
        };
      });
    } else {
      const equiposCapitan = await Team.findAll({
        where: {
          capitan_id: req.userId,
          sport_id: json.sport_id
        },
        attributes: ['id', 'name']
      });
      const teamIds = equiposCapitan.map((equipo) => equipo.id);

      if (teamIds.length > 0) {
        const inscripciones = await TorneoInscripcion.findAll({
          where: {
            torneo_id: torneoId,
            team_id: { [Op.in]: teamIds }
          },
          include: [
            {
              model: Team,
              as: 'equipo',
              attributes: ['id', 'name', 'logo_url']
            }
          ],
          order: [['creado_at', 'DESC']]
        });
        misInscripciones = inscripciones.map((inscripcion) => inscripcion.toJSON());
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        ...json,
        equipos_inscritos: equiposInscritos,
        num_fases: numFases,
        tipo_formato: numFases === 1 ? json.fases[0]?.tipo_formato ?? null : null,
        fecha_inicio: json.fecha_hora_inicio ?? json.fecha_inicio ?? null,
        es_organizador: esOrganizador,
        partidos,
        mis_inscripciones: misInscripciones
      }
    });
  } catch (error) {
    console.error('Error en getTorneoById:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener torneo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/torneos/:torneo_id/iniciar
 */
export const iniciarTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    if (!torneoId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id inválido'
      });
    }

    const torneo = await Torneos.findByPk(torneoId);
    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el organizador del torneo puede iniciarlo'
      });
    }

    if (!['PLANEACION', 'INSCRIPCIONES'].includes(torneo.estado)) {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede iniciar un torneo en planificación o con inscripciones abiertas'
      });
    }

    const equiposAceptados = await TorneoInscripcion.count({
      where: { torneo_id: torneoId, estado: 'ACEPTADA' }
    });

    if (equiposAceptados < 2) {
      return res.status(400).json({
        success: false,
        message: 'Se necesitan al menos 2 equipos con inscripción aceptada para iniciar el torneo'
      });
    }

    await torneo.update({ estado: 'EN_CURSO' });

    const torneoActualizado = await Torneos.findByPk(torneoId, {
      include: includeTorneo
    });

    return res.status(200).json({
      success: true,
      message: 'Torneo iniciado',
      data: torneoActualizado.toJSON()
    });
  } catch (error) {
    console.error('Error en iniciarTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al iniciar torneo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/torneos/:torneo_id/fases
 */
export const createFaseTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    if (!torneoId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id inválido'
      });
    }

    const torneo = await Torneos.findByPk(torneoId, { attributes: ['id', 'creado_por_user_id'] });
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

    const { orden, tipo_formato, nombre } = req.body;

    const ordenNum = parseId(orden);
    if (ordenNum === null || ordenNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'orden es obligatorio y debe ser un entero positivo'
      });
    }

    if (!tipo_formato || !TIPOS_FORMATO_VALIDOS.includes(tipo_formato)) {
      return res.status(400).json({
        success: false,
        message: 'tipo_formato debe ser TODOS_CONTRA_TODOS, ELIMINACION_DIRECTA o GRUPOS_ELIMINATORIAS'
      });
    }

    const fase = await FaseTorneo.create({
      torneo_id: torneoId,
      orden: ordenNum,
      tipo_formato,
      nombre: nombre ?? null
    });

    return res.status(201).json({
      success: true,
      message: 'Fase creada',
      data: fase.toJSON()
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una fase con ese orden en este torneo'
      });
    }

    console.error('Error en createFaseTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear fase',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/torneos/:torneo_id/fases/:fase_id/generar-fixture
 */
export const generarFixtureFase = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const faseId = parseId(req.params.fase_id);

    if (!torneoId || !faseId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id o fase_id inválido'
      });
    }

    const torneo = await Torneos.findByPk(torneoId);
    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el organizador puede generar el fixture'
      });
    }

    const fase = await FaseTorneo.findOne({
      where: { id: faseId, torneo_id: torneoId },
      attributes: ['id', 'torneo_id', 'tipo_formato', 'orden']
    });

    if (!fase) {
      return res.status(404).json({
        success: false,
        message: 'Fase no encontrada en este torneo'
      });
    }

    let grupoDivisionId = null;
    if (req.body?.grupo_division_id !== undefined && req.body?.grupo_division_id !== null) {
      grupoDivisionId = parseId(req.body.grupo_division_id);
      if (grupoDivisionId === null) {
        return res.status(400).json({
          success: false,
          message: 'grupo_division_id debe ser un número válido'
        });
      }
    }

    let resultado;

    if (fase.tipo_formato === 'TODOS_CONTRA_TODOS') {
      resultado = await generarRoundRobin(faseId, grupoDivisionId);
    } else if (fase.tipo_formato === 'ELIMINACION_DIRECTA') {
      resultado = await generarEliminacionDirecta(faseId);
    } else if (fase.tipo_formato === 'GRUPOS_ELIMINATORIAS') {
      const configValidacion = validarConfigGruposEliminatorias(torneo);
      if (!configValidacion.ok) {
        return res.status(400).json({
          success: false,
          message: configValidacion.errores.join('; '),
        });
      }

      resultado = await generarGruposEliminatorias(
        faseId,
        {
          numero_grupos: torneo.numero_grupos,
          clasificados_por_grupo: torneo.clasificados_por_grupo,
          metodo_distribucion: torneo.metodo_distribucion,
        },
        undefined,
        { confirmarBye: req.body?.confirmar_bye === true }
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'tipo_formato de la fase no soportado para generar fixture'
      });
    }

    if (resultado?.error) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    if (resultado?.requiere_confirmacion) {
      return res.status(409).json({
        success: false,
        requiere_confirmacion: true,
        advertencia: resultado.advertencia,
        totalClasificados: resultado.totalClasificados,
        tamanoBracket: resultado.tamanoBracket,
      });
    }

    return res.status(201).json({
      success: true,
      resultado
    });
  } catch (error) {
    console.error('Error en generarFixtureFase:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Error al generar fixture'
    });
  }
};

/**
 * POST /api/torneos/:torneo_id/fases/:fase_id/grupos
 */
export const createGrupoDivision = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const faseId = parseId(req.params.fase_id);

    if (!torneoId || !faseId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id o fase_id inválido'
      });
    }

    const torneo = await Torneos.findByPk(torneoId, { attributes: ['id', 'creado_por_user_id'] });
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

    const fase = await FaseTorneo.findOne({
      where: { id: faseId, torneo_id: torneoId }
    });

    if (!fase) {
      return res.status(404).json({
        success: false,
        message: 'Fase no encontrada en este torneo'
      });
    }

    const { nombre } = req.body;
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({
        success: false,
        message: 'nombre es obligatorio'
      });
    }

    const grupo = await GrupoDivision.create({
      fase_torneo_id: faseId,
      nombre: nombre.trim()
    });

    return res.status(201).json({
      success: true,
      message: 'Grupo creado',
      data: grupo.toJSON()
    });
  } catch (error) {
    console.error('Error en createGrupoDivision:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear grupo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/torneos/:torneo_id/grupos/:grupo_id/equipos
 */
export const asignarEquipoGrupo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const grupoId = parseId(req.params.grupo_id);

    if (!torneoId || !grupoId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id o grupo_id inválido'
      });
    }

    const torneo = await Torneos.findByPk(torneoId, { attributes: ['id', 'creado_por_user_id'] });
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

    const grupo = await GrupoDivision.findOne({
      where: { id: grupoId },
      include: [
        {
          model: FaseTorneo,
          as: 'fase',
          attributes: ['id', 'torneo_id']
        }
      ]
    });

    if (!grupo || grupo.fase?.torneo_id !== torneoId) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado en este torneo'
      });
    }

    const teamId = parseId(req.body?.team_id);
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'team_id es obligatorio y debe ser un número válido'
      });
    }

    const inscripcionAceptada = await TorneoInscripcion.findOne({
      where: {
        torneo_id: torneoId,
        team_id: teamId,
        estado: 'ACEPTADA'
      },
      attributes: ['id']
    });

    if (!inscripcionAceptada) {
      return res.status(400).json({
        success: false,
        message: 'El equipo debe tener inscripción aceptada antes de asignarse a un grupo'
      });
    }

    const asignacion = await GrupoEquipos.create({
      grupo_division_id: grupoId,
      team_id: teamId
    });

    return res.status(201).json({
      success: true,
      message: 'Equipo asignado al grupo',
      data: asignacion.toJSON()
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        success: false,
        message: 'Este equipo ya está en este grupo'
      });
    }

    console.error('Error en asignarEquipoGrupo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al asignar equipo al grupo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * DELETE /api/torneos/:torneo_id/grupos/:grupo_id/equipos/:team_id
 */
export const quitarEquipoGrupo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    const grupoId = parseId(req.params.grupo_id);
    const teamId = parseId(req.params.team_id);

    if (!torneoId || !grupoId || !teamId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id, grupo_id o team_id inválido'
      });
    }

    const torneo = await Torneos.findByPk(torneoId, { attributes: ['id', 'creado_por_user_id'] });
    if (!torneo) {
      return res.status(404).json({ success: false, message: 'Torneo no encontrado' });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el creador del torneo puede realizar esta acción'
      });
    }

    const grupo = await GrupoDivision.findOne({
      where: { id: grupoId },
      include: [{
        model: FaseTorneo,
        as: 'fase',
        attributes: ['id', 'torneo_id']
      }]
    });

    if (!grupo || grupo.fase?.torneo_id !== torneoId) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado en este torneo'
      });
    }

    const deleted = await GrupoEquipos.destroy({
      where: { grupo_division_id: grupoId, team_id: teamId }
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'El equipo no estaba asignado a este grupo'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Equipo quitado del grupo'
    });
  } catch (error) {
    console.error('Error en quitarEquipoGrupo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al quitar equipo del grupo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/torneos/:torneo_id/perfil
 * Perfil público: hero, resumen, partidos, equipos y bracket si aplica.
 */
export const getPerfilPublicoTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    if (!torneoId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id inválido',
      });
    }

    const data = await obtenerPerfilPublicoTorneo(torneoId, req.userId);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado',
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error en getPerfilPublicoTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el perfil del torneo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/torneos/:torneo_id/posiciones
 */
export const getPosicionesTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    if (!torneoId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id inválido'
      });
    }

    const torneo = await Torneos.findByPk(torneoId, { attributes: ['id', 'nombre'] });
    if (!torneo) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado'
      });
    }

    const grupoDivisionId = req.query.grupo_division_id
      ? parseId(req.query.grupo_division_id)
      : null;

    if (req.query.grupo_division_id && !grupoDivisionId) {
      return res.status(400).json({
        success: false,
        message: 'grupo_division_id inválido'
      });
    }

    const [posicionesRaw, inscritos] = await Promise.all([
      calcularPosicionesTorneo(torneoId, grupoDivisionId),
      TorneoInscripcion.findAll({
        where: { torneo_id: torneoId, estado: 'ACEPTADA' },
        include: [{
          model: Team,
          as: 'equipo',
          attributes: ['id', 'name', 'logo_url'],
        }],
      }),
    ]);

    const porId = new Map(
      posicionesRaw.map((fila) => [Number(fila.team_id), fila])
    );

    const vacia = (equipo) => ({
      team_id: equipo.id,
      team_nombre: equipo.name,
      team_logo_url: equipo.logo_url ?? null,
      partidos_jugados: 0,
      ganados: 0,
      perdidos: 0,
      sets_favor: 0,
      sets_contra: 0,
      puntos: 0,
      diferencia_sets: 0,
    });

    const posiciones = inscritos
      .map((inscripcion) => {
        const equipo = inscripcion.equipo;
        if (!equipo) return null;
        const existente = porId.get(Number(equipo.id));
        if (!existente) return vacia(equipo);
        return {
          ...existente,
          team_id: Number(existente.team_id),
          team_nombre: existente.team_nombre ?? equipo.name,
          team_logo_url: existente.team_logo_url ?? equipo.logo_url ?? null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if ((b.puntos ?? 0) !== (a.puntos ?? 0)) return (b.puntos ?? 0) - (a.puntos ?? 0);
        if ((b.diferencia_sets ?? 0) !== (a.diferencia_sets ?? 0)) {
          return (b.diferencia_sets ?? 0) - (a.diferencia_sets ?? 0);
        }
        return String(a.team_nombre ?? '').localeCompare(String(b.team_nombre ?? ''));
      });

    return res.status(200).json({
      success: true,
      torneo_id: torneoId,
      grupo_division_id: grupoDivisionId,
      total: posiciones.length,
      posiciones
    });
  } catch (error) {
    console.error('Error en getPosicionesTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al calcular posiciones del torneo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * POST /api/torneos/:torneo_id/generar-eliminatorias
 * Genera bracket de eliminatorias tras completar fase de grupos (organizador).
 */
export const generarEliminatoriasTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    if (!torneoId) {
      return res.status(400).json({ success: false, message: 'torneo_id inválido' });
    }

    const torneo = await Torneos.findByPk(torneoId, { attributes: ['id', 'creado_por_user_id'] });
    if (!torneo) {
      return res.status(404).json({ success: false, message: 'Torneo no encontrado' });
    }

    if (torneo.creado_por_user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el organizador puede generar eliminatorias',
      });
    }

    const resultado = await generarEliminatoriasDesdeGrupos(torneoId);

    if (resultado?.error) {
      return res.status(400).json({ success: false, message: resultado.error });
    }

    return res.status(201).json({ success: true, resultado });
  } catch (error) {
    console.error('Error en generarEliminatoriasTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al generar eliminatorias',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * GET /api/torneos/:torneo_id/horario-estado
 * Indica si el horario fue recalculado en vivo (momento 2) y el detalle de cambios.
 */
export const getHorarioEstadoTorneo = async (req, res) => {
  try {
    const torneoId = parseId(req.params.torneo_id);
    if (!torneoId) {
      return res.status(400).json({
        success: false,
        message: 'torneo_id inválido',
      });
    }

    const estado = await obtenerEstadoHorarioTorneo(torneoId);
    if (!estado) {
      return res.status(404).json({
        success: false,
        message: 'Torneo no encontrado',
      });
    }

    return res.status(200).json({
      success: true,
      data: estado,
    });
  } catch (error) {
    console.error('Error en getHorarioEstadoTorneo:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estado del horario',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
