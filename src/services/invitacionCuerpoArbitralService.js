import { Torneos, TorneoArbitros, User, Sports } from '../db/db.js';

const RESPUESTAS_VALIDAS = ['CONFIRMADO', 'RECHAZADO'];

export { RESPUESTAS_VALIDAS };

export async function obtenerDetalleInvitacionCuerpoArbitral(torneoId, registroId, usuarioId) {
  const registro = await TorneoArbitros.findOne({
    where: { id: registroId, torneo_id: torneoId },
    attributes: ['id', 'torneo_id', 'usuario_id', 'estado_confirmacion', 'creado_at'],
    include: [
      {
        model: Torneos,
        as: 'torneo',
        attributes: [
          'id',
          'nombre',
          'fecha_hora_inicio',
          'photo',
          'imagen_portada_url',
          'creado_por_user_id',
        ],
        include: [{
          model: Sports,
          as: 'sport',
          attributes: ['id', 'name'],
          required: false,
        }],
      },
    ],
  });

  if (!registro) {
    return { status: 404, message: 'Invitación no encontrada' };
  }

  if (registro.usuario_id !== usuarioId) {
    return { status: 403, message: 'No tienes acceso a esta invitación' };
  }

  const torneo = registro.torneo;
  let organizador = null;

  if (torneo?.creado_por_user_id) {
    organizador = await User.findByPk(torneo.creado_por_user_id, {
      attributes: ['id', 'name', 'nick', 'photo'],
    });
  }

  const torneoJson = torneo?.toJSON?.() ?? torneo ?? {};

  return {
    status: 200,
    data: {
      registro: {
        id: registro.id,
        estado_confirmacion: registro.estado_confirmacion,
      },
      torneo: {
        id: torneoJson.id,
        nombre: torneoJson.nombre,
        fecha_hora_inicio: torneoJson.fecha_hora_inicio,
        photo: torneoJson.photo,
        imagen_portada_url: torneoJson.imagen_portada_url,
        sport: torneoJson.sport ?? null,
      },
      organizador: organizador
        ? {
            id: organizador.id,
            name: organizador.name,
            nick: organizador.nick,
            photo: organizador.photo,
          }
        : null,
    },
  };
}

export async function responderInvitacionCuerpoArbitral(torneoId, registroId, usuarioId, respuesta) {
  if (!RESPUESTAS_VALIDAS.includes(respuesta)) {
    return { status: 400, message: 'respuesta debe ser CONFIRMADO o RECHAZADO' };
  }

  const registro = await TorneoArbitros.findOne({
    where: { id: registroId, torneo_id: torneoId },
    attributes: ['id', 'torneo_id', 'usuario_id', 'estado_confirmacion'],
    include: [{
      model: Torneos,
      as: 'torneo',
      attributes: ['id', 'nombre', 'creado_por_user_id'],
    }],
  });

  if (!registro) {
    return { status: 404, message: 'Invitación no encontrada' };
  }

  if (registro.usuario_id !== usuarioId) {
    return { status: 403, message: 'Solo el árbitro invitado puede responder' };
  }

  if ((registro.estado_confirmacion ?? 'PENDIENTE') !== 'PENDIENTE') {
    return { status: 400, message: 'Esta invitación ya fue respondida' };
  }

  await registro.update({ estado_confirmacion: respuesta });

  const arbitro = await User.findByPk(usuarioId, {
    attributes: ['id', 'name', 'nick'],
  });

  return {
    status: 200,
    data: {
      registro_id: registro.id,
      estado_confirmacion: respuesta,
      arbitro,
      torneo: registro.torneo,
      organizador_id: registro.torneo?.creado_por_user_id,
    },
  };
}
