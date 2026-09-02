import {
  Partidos,
  PartidoParticipantes,
  PartidoNominas,
  Team,
  TeamMiembros,
  MarcadoresDetalle,
  sequelize
} from '../db/db.js';

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

const EQUIPOS_VALIDOS = ['local', 'visitante'];

const construirArrayZonas = (zonasInput) => {
  const arr = new Array(6).fill(null);
  for (const item of zonasInput) {
    const zona = parseInt(item?.zona, 10);
    const jugadorId = parseId(item?.jugador_id);
    if (zona < 1 || zona > 6 || jugadorId == null) {
      return { error: 'Cada zona debe ser 1-6 con jugador_id numérico válido' };
    }
    if (arr[zona - 1] != null) {
      return { error: `Zona ${zona} duplicada` };
    }
    arr[zona - 1] = jugadorId;
  }
  if (arr.some((v) => v == null)) {
    return { error: 'Debes asignar los 6 jugadores (zonas 1 a 6)' };
  }
  const unicos = new Set(arr);
  if (unicos.size !== 6) {
    return { error: 'Cada jugador solo puede ocupar una zona' };
  }
  return { array: arr };
};

const esCapitanEquipo = async (teamId, userId, transaction) => {
  const equipo = await Team.findByPk(teamId, {
    attributes: ['id', 'capitan_id'],
    transaction
  });
  if (!equipo) return false;
  if (Number(equipo.capitan_id) === Number(userId)) return true;

  const miembro = await TeamMiembros.findOne({
    where: { team_id: teamId, user_id: userId, rol: 'CAPITAN' },
    attributes: ['id'],
    transaction
  });
  return Boolean(miembro);
};

/**
 * POST /api/partidos/:id/alineacion
 * Body: { equipo: 'local'|'visitante', zonas: [{ zona, jugador_id }] }
 */
export const registrarAlineacion = async (req, res) => {
  try {
    const partidoId = parseId(req.params.id ?? req.params.partido_id);
    if (!partidoId) {
      return res.status(400).json({ success: false, message: 'partido_id inválido' });
    }

    const equipo = req.body?.equipo;
    if (!EQUIPOS_VALIDOS.includes(equipo)) {
      return res.status(400).json({
        success: false,
        message: "equipo debe ser 'local' o 'visitante'"
      });
    }

    const zonasInput = req.body?.zonas;
    if (!Array.isArray(zonasInput) || zonasInput.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'zonas debe ser un array de exactamente 6 elementos { zona, jugador_id }'
      });
    }

    const { array, error: errorZonas } = construirArrayZonas(zonasInput);
    if (errorZonas) {
      return res.status(400).json({ success: false, message: errorZonas });
    }

    const partido = await Partidos.findByPk(partidoId, {
      attributes: [
        'id',
        'state',
        'alineacion_local',
        'alineacion_visitante',
        'equipo_que_saca_inicial'
      ]
    });

    if (!partido) {
      return res.status(404).json({ success: false, message: 'Partido no encontrado' });
    }

    const state = partido.state ?? 'PROGRAMADO';
    if (state !== 'PROGRAMADO' && state !== 'pendiente' && state !== 'EN_CURSO') {
      return res.status(400).json({
        success: false,
        message: 'Solo se puede definir alineación antes o al inicio del partido'
      });
    }

    const campoAlineacion = equipo === 'local' ? 'alineacion_local' : 'alineacion_visitante';
    if (partido[campoAlineacion] != null) {
      return res.status(409).json({
        success: false,
        message: 'La alineación de este equipo ya fue definida para el partido'
      });
    }

    const participantes = await PartidoParticipantes.findAll({
      where: { partido_id: partidoId },
      attributes: ['team_id', 'es_local']
    });

    const participante = participantes.find((p) =>
      equipo === 'local' ? p.es_local === true : p.es_local === false
    );

    if (!participante?.team_id) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró el equipo participante'
      });
    }

    const teamId = participante.team_id;

    const esCapitan = await esCapitanEquipo(teamId, req.userId);
    if (!esCapitan) {
      return res.status(403).json({
        success: false,
        message: 'Solo el capitán del equipo puede registrar la alineación'
      });
    }

    for (const jugadorId of array) {
      const enNomina = await PartidoNominas.findOne({
        where: {
          partido_id: partidoId,
          team_id: teamId,
          user_id: jugadorId,
          estado_validacion: 'VALIDADO'
        },
        attributes: ['id']
      });
      if (!enNomina) {
        return res.status(400).json({
          success: false,
          message: `El jugador ${jugadorId} no está en la nómina validada de tu equipo`
        });
      }
    }

    const updatePayload = { [campoAlineacion]: array };

    await sequelize.transaction(async (transaction) => {
      await partido.update(updatePayload, { transaction });

      const marcador = await MarcadoresDetalle.findOne({
        where: { partido_id: partidoId },
        transaction
      });

      if (marcador) {
        const posiciones = {
          ...(marcador.posiciones_actuales ?? {
            equipo_local: null,
            equipo_visitante: null
          })
        };
        if (equipo === 'local') {
          posiciones.equipo_local = array;
        } else {
          posiciones.equipo_visitante = array;
        }

        const marcadorUpdate = { posiciones_actuales: posiciones };

        await marcador.update(marcadorUpdate, { transaction });
      }
    });

    const partidoActualizado = await Partidos.findByPk(partidoId, {
      attributes: [
        'id',
        'alineacion_local',
        'alineacion_visitante',
        'equipo_que_saca_inicial'
      ]
    });

    return res.status(201).json({
      success: true,
      message: 'Alineación registrada',
      data: {
        equipo,
        zonas: array,
        alineacion_local: partidoActualizado.alineacion_local,
        alineacion_visitante: partidoActualizado.alineacion_visitante,
        equipo_que_saca_inicial: partidoActualizado.equipo_que_saca_inicial
      }
    });
  } catch (error) {
    console.error('Error en registrarAlineacion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar alineación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
