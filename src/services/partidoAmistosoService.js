import { sequelize, Partidos, PartidoParticipantes, Team, User, Sports } from '../db/db.js';
import { notificarAsignacionArbitro } from './notificacionesService.js';
import { scheduleSideEffect } from '../utils/scheduleSideEffect.js';

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

export const esPracticaInterna = (participantes) =>
  participantes.length === 2
  && participantes[0].team_id === participantes[1].team_id;

export const crearPartidoAmistoso = async ({
  userId,
  equipoLocalId,
  equipoVisitanteId,
  datetime,
  canchaId = null,
  lugar = null,
  arbitroId = null,
  nivelArbitraje = 'BASICO',
}) => {
  const localId = parseId(equipoLocalId);
  const visitanteId = parseId(equipoVisitanteId);

  if (!localId || !visitanteId) {
    return { status: 400, message: 'equipo_local_id y equipo_visitante_id son obligatorios' };
  }

  const [equipoLocal, equipoVisitante] = await Promise.all([
    Team.findByPk(localId, { attributes: ['id', 'name', 'sport_id', 'capitan_id'] }),
    Team.findByPk(visitanteId, { attributes: ['id', 'name', 'sport_id', 'capitan_id'] }),
  ]);

  if (!equipoLocal || !equipoVisitante) {
    return { status: 404, message: 'Uno o ambos equipos no existen' };
  }

  if (equipoLocal.sport_id !== equipoVisitante.sport_id) {
    return { status: 400, message: 'Los equipos deben ser del mismo deporte' };
  }

  const esPractica = localId === visitanteId;
  const esCapitanLocal = equipoLocal.capitan_id === userId;
  const esCapitanVisitante = !esPractica && equipoVisitante.capitan_id === userId;

  if (!esPractica && !esCapitanLocal && !esCapitanVisitante) {
    return {
      status: 403,
      message: 'Solo un capitán de los equipos puede programar el amistoso',
    };
  }

  if (esPractica && !esCapitanLocal) {
    return {
      status: 403,
      message: 'Solo el capitán del equipo puede programar una práctica interna',
    };
  }

  if (arbitroId) {
    const arbitro = await User.findByPk(parseId(arbitroId), { attributes: ['id'] });
    if (!arbitro) {
      return { status: 404, message: 'Árbitro no encontrado' };
    }
  }

  const nombrePartido = esPractica
    ? `${equipoLocal.name} — práctica interna`
    : `${equipoLocal.name} vs ${equipoVisitante.name}`;

  const partido = await sequelize.transaction(async (transaction) => {
    const creado = await Partidos.create(
      {
        name: nombrePartido,
        torneo_id: null,
        fase_torneo_id: null,
        grupo_division_id: null,
        sport_id: equipoLocal.sport_id,
        cancha_id: canchaId,
        datetime: datetime ? new Date(datetime) : null,
        state: 'PROGRAMADO',
        tipo: 'AMISTOSO',
        nivel_arbitraje: nivelArbitraje === 'AVANZADO' ? 'AVANZADO' : 'BASICO',
        arbitro_asignado_id: arbitroId ? parseId(arbitroId) : null,
        arbitro_confirmacion_estado: arbitroId ? 'PENDIENTE' : null,
        programado_por_id: userId,
      },
      { transaction },
    );

    await PartidoParticipantes.create(
      { partido_id: creado.id, team_id: localId, es_local: true },
      { transaction },
    );

    await PartidoParticipantes.create(
      { partido_id: creado.id, team_id: visitanteId, es_local: false },
      { transaction },
    );

    return creado;
  });

  if (arbitroId) {
    scheduleSideEffect('asignacion-arbitro-amistoso', () => notificarAsignacionArbitro({
      partidoId: partido.id,
      arbitroId: parseId(arbitroId),
      torneo: { nombre: nombrePartido },
    }));
  }

  return {
    status: 201,
    data: {
      id: partido.id,
      name: partido.name,
      datetime: partido.datetime,
      es_practica_interna: esPractica,
      lugar,
    },
  };
};
