import {
  Partidos,
  PartidoParticipantes,
  Team,
  Sports,
  Torneos,
  Canchas,
  Complejos,
  User,
} from '../db/db.js';

const ESTADOS_CONFIRMACION = ['PENDIENTE', 'CONFIRMADO', 'RECHAZADO'];

export { ESTADOS_CONFIRMACION };

function resolverLugar(partidoJson) {
  const cancha = partidoJson.cancha;
  const complejo = cancha?.complejo;
  const partes = [];

  if (cancha?.nombre) partes.push(cancha.nombre);
  if (complejo?.nombre) partes.push(complejo.nombre);
  if (complejo?.ubicacion) partes.push(complejo.ubicacion);

  return partes.length ? partes.join(' · ') : null;
}

export async function obtenerDetalleAsignacionArbitro(partidoId, arbitroUserId) {
  const partido = await Partidos.findByPk(partidoId, {
    attributes: [
      'id',
      'datetime',
      'jornada',
      'torneo_id',
      'arbitro_asignado_id',
      'arbitro_confirmacion_estado',
      'cancha_id',
    ],
    include: [
      {
        model: Sports,
        as: 'sport',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Torneos,
        as: 'torneo',
        attributes: ['id', 'nombre', 'creado_por_user_id'],
        required: false,
      },
      {
        model: Canchas,
        as: 'cancha',
        attributes: ['id', 'nombre'],
        required: false,
        include: [{
          model: Complejos,
          as: 'complejo',
          attributes: ['id', 'nombre', 'ubicacion'],
          required: false,
        }],
      },
      {
        model: PartidoParticipantes,
        as: 'participantes',
        attributes: ['team_id', 'es_local'],
        include: [{
          model: Team,
          as: 'equipo',
          attributes: ['id', 'name', 'logo_url'],
        }],
      },
    ],
  });

  if (!partido) {
    return { status: 404, message: 'Partido no encontrado' };
  }

  if (partido.arbitro_asignado_id !== arbitroUserId) {
    return { status: 403, message: 'No tienes una asignación de arbitraje pendiente en este partido' };
  }

  const partidoJson = partido.toJSON();
  const participantes = partidoJson.participantes ?? [];
  const local = participantes.find((p) => p.es_local === true);
  const visitante = participantes.find((p) => !p.es_local);

  return {
    status: 200,
    data: {
      partido: {
        id: partidoJson.id,
        datetime: partidoJson.datetime,
        jornada: partidoJson.jornada,
        arbitro_confirmacion_estado: partidoJson.arbitro_confirmacion_estado ?? 'PENDIENTE',
        sport: partidoJson.sport ?? null,
        torneo: partidoJson.torneo
          ? { id: partidoJson.torneo.id, nombre: partidoJson.torneo.nombre }
          : null,
        equipo_local: local?.equipo ?? null,
        equipo_visitante: visitante?.equipo ?? null,
        lugar: resolverLugar(partidoJson),
      },
    },
  };
}

export async function responderConfirmacionArbitro(partidoId, arbitroUserId, respuesta) {
  if (!ESTADOS_CONFIRMACION.includes(respuesta) || respuesta === 'PENDIENTE') {
    return { status: 400, message: 'respuesta debe ser CONFIRMADO o RECHAZADO' };
  }

  const partido = await Partidos.findByPk(partidoId, {
    attributes: [
      'id',
      'torneo_id',
      'arbitro_asignado_id',
      'arbitro_confirmacion_estado',
    ],
    include: [{
      model: PartidoParticipantes,
      as: 'participantes',
      attributes: ['es_local'],
      include: [{
        model: Team,
        as: 'equipo',
        attributes: ['name'],
      }],
    }],
  });

  if (!partido) {
    return { status: 404, message: 'Partido no encontrado' };
  }

  if (partido.arbitro_asignado_id !== arbitroUserId) {
    return { status: 403, message: 'Solo el árbitro asignado puede confirmar o rechazar' };
  }

  if (partido.arbitro_confirmacion_estado && partido.arbitro_confirmacion_estado !== 'PENDIENTE') {
    return { status: 400, message: 'Esta asignación ya fue respondida' };
  }

  const updatePayload = { arbitro_confirmacion_estado: respuesta };

  if (respuesta === 'RECHAZADO') {
    updatePayload.arbitro_asignado_id = null;
    updatePayload.arbitro_confirmacion_estado = null;
  }

  await partido.update(updatePayload);

  const arbitro = await User.findByPk(arbitroUserId, {
    attributes: ['id', 'name', 'nick'],
  });

  const participantes = partido.participantes ?? [];
  const local = participantes.find((p) => p.es_local);
  const visitante = participantes.find((p) => !p.es_local);

  let torneo = null;
  if (partido.torneo_id) {
    torneo = await Torneos.findByPk(partido.torneo_id, {
      attributes: ['id', 'nombre', 'creado_por_user_id'],
    });
  }

  return {
    status: 200,
    data: {
      partido_id: partidoId,
      arbitro_confirmacion_estado: respuesta === 'RECHAZADO' ? 'RECHAZADO' : respuesta,
      arbitro,
      torneo,
      equipo_local: local?.equipo?.name ?? 'Local',
      equipo_visitante: visitante?.equipo?.name ?? 'Visitante',
    },
  };
}
