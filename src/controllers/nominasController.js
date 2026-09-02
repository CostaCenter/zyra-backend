import { UniqueConstraintError } from 'sequelize';
import {
  Partidos,
  PartidoParticipantes,
  PartidoNominas,
  MarcadoresDetalle,
  Team,
  TeamMiembros,
  User,
  sequelize
} from '../db/db.js';
import {
  validarMaxJugadoresEquipoTorneo,
  validarElegibilidadEliminatorias,
} from '../services/torneoNominaValidaciones.js';
import {
  validarPayloadAlineacionUnificada,
  construirArrayAlineacionDesdeNominas,
} from '../services/nominaAlineacionService.js';
import { notificarNominaPropuesta } from '../services/notificacionesService.js';
import {
  alineacionSetCompleta,
  aplicarAlineacionConfirmadaAlMarcador,
  cargarAlineacionesPorSet,
} from '../services/alineacionPorSetService.js';
import { notificarMarcadorEnVivo } from '../services/marcadorEnVivoNotifyService.js';

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const ROLES_NOMINA_VALIDOS = ['TITULAR', 'SUPLENTE'];
const RESULTADOS_VALIDACION_VALIDOS = ['VALIDADO', 'RECHAZADO'];

const includeNominaCompleta = [
  {
    model: User,
    as: 'jugador',
    attributes: ['id', 'name', 'nick']
  },
  {
    model: Team,
    as: 'equipo',
    attributes: ['id', 'name']
  },
  {
    model: User,
    as: 'validadoPor',
    attributes: ['id', 'name', 'nick']
  }
];

const mensajeUniqueConstraintNomina = (error) => {
  const constraint = String(error?.parent?.constraint ?? error?.fields ?? '');

  if (
    constraint.includes('uq_partido_team_dorsal')
    || constraint.includes('partido_nominas_partido_id_team_id_dorsal')
    || error?.fields?.dorsal
  ) {
    return 'Dorsal duplicado en la nómina de este equipo para este set';
  }

  if (
    constraint.includes('uq_partido_jugador')
    || constraint.includes('partido_nominas_partido_id_user_id')
    || error?.fields?.user_id
  ) {
    return 'Un jugador no puede aparecer más de una vez en la nómina del mismo set';
  }

  return 'Conflicto de unicidad en la nómina (dorsal o jugador duplicado)';
};

/**
 * POST /api/partidos/:partido_id/nominas
 * Propuesta unificada: nómina + alineación en cancha (capitán).
 * Body: { team_id, jugadores: [{ user_id, dorsal, rol_nomina, zona? }] }
 */
export const proponerNomina = async (req, res) => {
  try {
    const partidoId = parseId(req.params.partido_id ?? req.params.id);
    if (!partidoId) {
      return res.status(400).json({
        success: false,
        message: 'partido_id inválido'
      });
    }

    const partido = await Partidos.findByPk(partidoId, {
      attributes: ['id', 'state', 'equipo_que_saca_inicial', 'torneo_id', 'fase_torneo_id', 'arbitro_asignado_id']
    });
    if (!partido) {
      return res.status(404).json({
        success: false,
        message: 'Partido no encontrado'
      });
    }

    const state = partido.state ?? 'PROGRAMADO';
    const setNumero = parseInt(req.body?.set_numero ?? 1, 10);
    if (Number.isNaN(setNumero) || setNumero < 1) {
      return res.status(400).json({
        success: false,
        message: 'set_numero debe ser un entero >= 1',
      });
    }

    const esPrePartido = state === 'PROGRAMADO' || state === 'pendiente';
    const esEnCurso = state === 'EN_CURSO';

    if (!esPrePartido && !esEnCurso) {
      return res.status(400).json({
        success: false,
        message: 'No se puede enviar alineación en el estado actual del partido',
      });
    }

    if (esPrePartido && setNumero !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Antes del partido solo se puede enviar la alineación del set 1',
      });
    }

    if (esEnCurso) {
      const marcador = await MarcadoresDetalle.findOne({
        where: { partido_id: partidoId },
        attributes: ['id', 'metrica_estructura', 'resultado_principal'],
      });
      if (!marcador || marcador.resultado_principal !== 0) {
        return res.status(400).json({
          success: false,
          message: 'El partido no está en curso',
        });
      }
      const pendiente = marcador.metrica_estructura?.pendiente_alineacion_set;
      if (pendiente !== setNumero) {
        return res.status(400).json({
          success: false,
          message: `Solo se puede enviar alineación para el set ${pendiente ?? '?'} en este momento`,
        });
      }
    }

    const teamId = parseId(req.body?.team_id);
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'team_id es obligatorio y debe ser un número válido'
      });
    }

    const equipo = await Team.findByPk(teamId, { attributes: ['id', 'capitan_id', 'name'] });
    if (!equipo) {
      return res.status(404).json({
        success: false,
        message: 'Equipo no encontrado'
      });
    }

    if (equipo.capitan_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el capitán del equipo puede enviar la alineación'
      });
    }

    const participacion = await PartidoParticipantes.findOne({
      where: { partido_id: partidoId, team_id: teamId },
      attributes: ['id', 'es_local']
    });

    if (!participacion) {
      return res.status(400).json({
        success: false,
        message: 'El equipo no participa en este partido'
      });
    }

    const jugadores = req.body?.jugadores;
    const validacionAlineacion = validarPayloadAlineacionUnificada(jugadores);
    if (validacionAlineacion.error) {
      return res.status(400).json({
        success: false,
        message: validacionAlineacion.error
      });
    }

    for (const jugador of jugadores) {
      if (!ROLES_NOMINA_VALIDOS.includes(jugador?.rol_nomina)) {
        return res.status(400).json({
          success: false,
          message: "rol_nomina debe ser 'TITULAR' o 'SUPLENTE'"
        });
      }

      if (parseId(jugador?.user_id) == null) {
        return res.status(400).json({
          success: false,
          message: 'Cada jugador debe tener un user_id válido'
        });
      }

      const dorsal = parseInt(jugador?.dorsal, 10);
      if (Number.isNaN(dorsal) || dorsal < 0) {
        return res.status(400).json({
          success: false,
          message: 'Cada jugador debe tener un dorsal numérico válido'
        });
      }
    }

    const userIds = jugadores.map((j) => parseId(j.user_id));
    const miembros = await TeamMiembros.findAll({
      where: { team_id: teamId, user_id: userIds },
      attributes: ['user_id', 'estado_invitacion']
    });
    const miembrosMap = new Map(miembros.map((m) => [m.user_id, m.estado_invitacion]));
    const noMiembros = userIds.filter((uid) => !miembrosMap.has(uid));
    const noAceptados = userIds.filter(
      (uid) => miembrosMap.has(uid) && miembrosMap.get(uid) !== 'ACEPTADO'
    );

    if (noMiembros.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Los siguientes user_id no pertenecen al equipo: ${noMiembros.join(', ')}`
      });
    }

    if (noAceptados.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Los siguientes user_id no tienen invitación aceptada en el equipo: ${noAceptados.join(', ')}`
      });
    }

    const validacionMaxJugadores = await validarMaxJugadoresEquipoTorneo(
      partido.torneo_id,
      jugadores.length
    );
    if (!validacionMaxJugadores.ok) {
      return res.status(400).json({
        success: false,
        message: validacionMaxJugadores.error,
      });
    }

    const validacionEliminatorias = await validarElegibilidadEliminatorias(
      partido,
      userIds
    );
    if (!validacionEliminatorias.ok) {
      return res.status(400).json({
        success: false,
        message: validacionEliminatorias.error,
      });
    }

    const nominasExistentes = await PartidoNominas.findAll({
      where: { partido_id: partidoId, team_id: teamId, set_numero: setNumero },
      attributes: ['id', 'estado_validacion'],
    });

    if (nominasExistentes.some((n) => n.estado_validacion === 'PENDIENTE')) {
      return res.status(409).json({
        success: false,
        message: 'Ya hay una alineación pendiente de validación para este equipo'
      });
    }

    if (nominasExistentes.some((n) => n.estado_validacion === 'VALIDADO')) {
      return res.status(409).json({
        success: false,
        message: 'La alineación de este equipo ya fue validada'
      });
    }

    const nominasCreadas = await sequelize.transaction(async (transaction) => {
      if (nominasExistentes.length > 0) {
        await PartidoNominas.destroy({
          where: { partido_id: partidoId, team_id: teamId, set_numero: setNumero },
          transaction
        });
      }

      const creadas = [];

      for (const jugador of jugadores) {
        const zona = jugador.rol_nomina === 'TITULAR'
          ? parseInt(jugador.zona, 10)
          : null;

        const nomina = await PartidoNominas.create(
          {
            partido_id: partidoId,
            team_id: teamId,
            user_id: parseId(jugador.user_id),
            dorsal: parseInt(jugador.dorsal, 10),
            rol_nomina: jugador.rol_nomina,
            zona,
            set_numero: setNumero,
            propuesto_por_id: req.userId,
            estado_validacion: 'PENDIENTE'
          },
          { transaction }
        );
        creadas.push(nomina);
      }

      return creadas;
    });

    await notificarNominaPropuesta({
      partidoId,
      arbitroId: partido.arbitro_asignado_id,
      equipo,
      setNumero,
    });

    return res.status(201).json({
      success: true,
      message: 'Alineación enviada al árbitro',
      data: nominasCreadas.map((n) => n.toJSON())
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        success: false,
        message: mensajeUniqueConstraintNomina(error)
      });
    }

    console.error('Error en proponerNomina:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al enviar alineación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * PUT /api/partidos/:partido_id/nominas/validar
 */
export const validarNomina = async (req, res) => {
  try {
    const partidoId = parseId(req.params.partido_id);
    if (!partidoId) {
      return res.status(400).json({
        success: false,
        message: 'partido_id inválido'
      });
    }

    const partido = await Partidos.findByPk(partidoId, {
      attributes: [
        'id',
        'arbitro_asignado_id',
        'alineacion_local',
        'alineacion_visitante'
      ]
    });

    if (!partido) {
      return res.status(404).json({
        success: false,
        message: 'Partido no encontrado'
      });
    }

    if (partido.arbitro_asignado_id == null) {
      return res.status(400).json({
        success: false,
        message: 'Este partido no tiene árbitro asignado. Pide al organizador del torneo que asigne uno primero.'
      });
    }

    if (partido.arbitro_asignado_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el árbitro asignado puede validar la nómina'
      });
    }

    const teamId = parseId(req.body?.team_id);
    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: 'team_id es obligatorio y debe ser un número válido'
      });
    }

    const resultado = req.body?.resultado;
    if (!RESULTADOS_VALIDACION_VALIDOS.includes(resultado)) {
      return res.status(400).json({
        success: false,
        message: "resultado debe ser 'VALIDADO' o 'RECHAZADO'"
      });
    }

    const setNumero = parseInt(req.body?.set_numero ?? 1, 10);
    if (Number.isNaN(setNumero) || setNumero < 1) {
      return res.status(400).json({
        success: false,
        message: 'set_numero debe ser un entero >= 1',
      });
    }

    const pendientes = await PartidoNominas.count({
      where: {
        partido_id: partidoId,
        team_id: teamId,
        set_numero: setNumero,
        estado_validacion: 'PENDIENTE',
      },
    });

    if (pendientes === 0) {
      return res.status(404).json({
        success: false,
        message: `No hay nómina pendiente de validación para este equipo en el set ${setNumero}`,
      });
    }

    const validadoAt = new Date();

    const participacion = await PartidoParticipantes.findOne({
      where: { partido_id: partidoId, team_id: teamId },
      attributes: ['es_local'],
    });

    const nominasEquipo = await PartidoNominas.findAll({
      where: { partido_id: partidoId, team_id: teamId, set_numero: setNumero },
      attributes: ['id', 'user_id', 'rol_nomina', 'zona', 'estado_validacion', 'set_numero'],
    });

    if (resultado === 'VALIDADO') {
      const arrayAlineacion = construirArrayAlineacionDesdeNominas(nominasEquipo);
      if (!arrayAlineacion) {
        return res.status(400).json({
          success: false,
          message: 'La propuesta no incluye 6 titulares con zonas 1-6 completas',
        });
      }

      const yaValidada = nominasEquipo.every((n) => n.estado_validacion === 'VALIDADO');
      if (yaValidada) {
        return res.status(409).json({
          success: false,
          message: `Este equipo ya tiene alineación confirmada para el set ${setNumero}`,
        });
      }
    }

    await sequelize.transaction(async (transaction) => {
      await PartidoNominas.update(
        {
          estado_validacion: resultado,
          validado_por_id: req.userId,
          validado_at: validadoAt,
        },
        {
          where: { partido_id: partidoId, team_id: teamId, set_numero: setNumero },
          transaction,
        }
      );

      if (resultado === 'VALIDADO') {
        const arrayAlineacion = construirArrayAlineacionDesdeNominas(nominasEquipo);
        const campoAlineacion = participacion?.es_local === true
          ? 'alineacion_local'
          : 'alineacion_visitante';

        await partido.update(
          { [campoAlineacion]: arrayAlineacion },
          { transaction }
        );

        const alineacionesPorSet = await cargarAlineacionesPorSet(partidoId, transaction);

        if (alineacionSetCompleta(alineacionesPorSet, setNumero)) {
          const marcador = await MarcadoresDetalle.findOne({
            where: { partido_id: partidoId },
            transaction,
          });

          if (marcador) {
            const actualizacion = aplicarAlineacionConfirmadaAlMarcador({
              marcadorRow: marcador,
              partidoRow: partido,
              alineacionesPorSet,
              setNumero,
            });

            if (actualizacion) {
              await marcador.update(
                {
                  posiciones_actuales: actualizacion.posiciones_actuales,
                  equipo_que_saca: actualizacion.equipo_que_saca,
                  metrica_estructura: actualizacion.metrica_estructura,
                  actualizado_en: new Date(),
                },
                { transaction }
              );
            }
          }
        }
      }
    });

    const nominasActualizadas = await PartidoNominas.findAll({
      where: { partido_id: partidoId, team_id: teamId, set_numero: setNumero },
      include: includeNominaCompleta,
      order: [['dorsal', 'ASC']],
    });

    const marcadorActualizado = await MarcadoresDetalle.findOne({
      where: { partido_id: partidoId },
    });
    if (marcadorActualizado) {
      await notificarMarcadorEnVivo(partidoId, {
        marcador: marcadorActualizado,
        partido,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Alineación set ${setNumero} ${resultado.toLowerCase()}`,
      data: nominasActualizadas.map((n) => n.toJSON()),
    });
  } catch (error) {
    console.error('Error en validarNomina:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al validar nómina',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * GET /api/partidos/:partido_id/nominas
 */
export const listarNominasPartido = async (req, res) => {
  try {
    const partidoId = parseId(req.params.partido_id);
    if (!partidoId) {
      return res.status(400).json({
        success: false,
        message: 'partido_id inválido'
      });
    }

    const partido = await Partidos.findByPk(partidoId, { attributes: ['id'] });
    if (!partido) {
      return res.status(404).json({
        success: false,
        message: 'Partido no encontrado'
      });
    }

    const setNumeroQuery = parseInt(req.query?.set_numero, 10);
    const where = { partido_id: partidoId };
    if (!Number.isNaN(setNumeroQuery) && setNumeroQuery >= 1) {
      where.set_numero = setNumeroQuery;
    }

    const nominas = await PartidoNominas.findAll({
      where,
      include: includeNominaCompleta,
      order: [['set_numero', 'ASC'], ['team_id', 'ASC'], ['rol_nomina', 'ASC'], ['dorsal', 'ASC']],
    });

    return res.status(200).json({
      success: true,
      total: nominas.length,
      data: nominas.map((n) => n.toJSON())
    });
  } catch (error) {
    console.error('Error en listarNominasPartido:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar nóminas del partido',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
