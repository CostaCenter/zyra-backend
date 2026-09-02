import {
  Notificaciones,
  TeamMiembros,
  Team,
  TorneoInscripcion,
  Torneos,
  TorneoArbitros,
  Partidos,
  PartidoParticipantes,
  PublicacionEtiquetas,
  Seguidores,
} from '../db/db.js';
import {
  categoriaDeTipo,
  esCategoriaValida,
  listarCategoriasDisponibles,
} from '../constants/notificacionCategorias.js';
import { emitNuevaNotificacion } from '../socket/partidoSocket.js';
import { enviarPushNotificacionUsuario } from './pushNotificationService.js';

export const TIPOS_NOTIFICACION = {
  INVITACION_EQUIPO: 'INVITACION_EQUIPO',
  RESPUESTA_INVITACION_EQUIPO: 'RESPUESTA_INVITACION_EQUIPO',
  SOLICITUD_INSCRIPCION: 'SOLICITUD_INSCRIPCION',
  RESPUESTA_INVITACION_TORNEO: 'RESPUESTA_INVITACION_TORNEO',
  ASIGNACION_ARBITRO: 'ASIGNACION_ARBITRO',
  INVITACION_CUERPO_ARBITRAL: 'INVITACION_CUERPO_ARBITRAL',
  RESPUESTA_INVITACION_CUERPO_ARBITRAL: 'RESPUESTA_INVITACION_CUERPO_ARBITRAL',
  RESPUESTA_ASIGNACION_ARBITRO: 'RESPUESTA_ASIGNACION_ARBITRO',
  NOMINA_PROPUESTA: 'NOMINA_PROPUESTA',
  ALINEACION_PENDIENTE_SET: 'ALINEACION_PENDIENTE_SET',
  RESULTADO_PARTIDO: 'RESULTADO_PARTIDO',
  NUEVO_SEGUIDOR: 'NUEVO_SEGUIDOR',
  ETIQUETA_PENDIENTE: 'ETIQUETA_PENDIENTE',
  INSCRIPCION_ACEPTADA: 'INSCRIPCION_ACEPTADA',
  INSCRIPCION_RECHAZADA: 'INSCRIPCION_RECHAZADA',
};

const displayName = (user) => user?.nick || user?.name || 'Alguien';

async function publicarNotificacionEnVivo(notificacion, usuarioId) {
  try {
    const json = typeof notificacion.toJSON === 'function'
      ? notificacion.toJSON()
      : notificacion;
    const navegacion = await resolverNavegacion(json);
    const noLeidas = await contarNoLeidas(usuarioId);
    const notificacionSerializada = serializarNotificacion(json, navegacion);

    emitNuevaNotificacion(usuarioId, {
      notificacion: notificacionSerializada,
      no_leidas: noLeidas,
    });

    await enviarPushNotificacionUsuario(usuarioId, {
      notificacion: notificacionSerializada,
      navegacion,
    });
  } catch (error) {
    console.error('Error emitiendo nueva_notificacion:', error);
  }
}

export async function crearNotificacion({
  usuarioId,
  tipo,
  mensaje,
  referenciaId = null,
  referenciaTipo = null,
  transaction = null,
}) {
  if (!usuarioId || !tipo || !mensaje) return null;

  const categoria = categoriaDeTipo(tipo);

  const row = await Notificaciones.create(
    {
      usuario_id: usuarioId,
      tipo,
      categoria,
      mensaje,
      referencia_id: referenciaId,
      referencia_tipo: referenciaTipo,
      leida: false,
    },
    { transaction }
  );

  if (!row) return null;

  const publish = () => publicarNotificacionEnVivo(row, usuarioId);

  if (transaction) {
    transaction.afterCommit(publish);
  } else {
    await publish();
  }

  return row;
}

export async function notificarInvitacionEquipo({
  membresiaId,
  usuarioInvitadoId,
  capitan,
  equipo,
  transaction = null,
}) {
  const nombreCapitan = displayName(capitan);
  const nombreEquipo = equipo?.name || 'un equipo';

  return crearNotificacion({
    usuarioId: usuarioInvitadoId,
    tipo: TIPOS_NOTIFICACION.INVITACION_EQUIPO,
    mensaje: `**${nombreCapitan}** te invitó a unirte a **${nombreEquipo}**`,
    referenciaId: membresiaId,
    referenciaTipo: 'TEAM_MIEMBRO',
    transaction,
  });
}

export async function notificarSolicitudInscripcion({
  inscripcionId,
  torneoId,
  equipo,
  transaction = null,
}) {
  const torneo = await Torneos.findByPk(torneoId, {
    attributes: ['id', 'nombre', 'creado_por_user_id'],
    transaction,
  });

  if (!torneo?.creado_por_user_id) return null;

  const nombreEquipo = equipo?.name || 'Un equipo';
  const nombreTorneo = torneo.nombre || 'tu torneo';

  return crearNotificacion({
    usuarioId: torneo.creado_por_user_id,
    tipo: TIPOS_NOTIFICACION.SOLICITUD_INSCRIPCION,
    mensaje: `**${nombreEquipo}** solicitó inscribirse en **${nombreTorneo}**`,
    referenciaId: inscripcionId,
    referenciaTipo: 'TORNEO_INSCRIPCION',
    transaction,
  });
}

export async function notificarInvitacionCuerpoArbitral({
  registroId,
  arbitroId,
  torneo,
  organizador,
  transaction = null,
}) {
  if (!arbitroId) return null;

  const nombreOrganizador = displayName(organizador);
  const nombreTorneo = torneo?.nombre || 'un torneo';

  return crearNotificacion({
    usuarioId: arbitroId,
    tipo: TIPOS_NOTIFICACION.INVITACION_CUERPO_ARBITRAL,
    mensaje: `**${nombreOrganizador}** te invitó al cuerpo arbitral de **${nombreTorneo}**`,
    referenciaId: registroId,
    referenciaTipo: 'TORNEO_ARBITRO',
    transaction,
  });
}

export async function notificarRespuestaInvitacionCuerpoArbitral({
  organizadorId,
  arbitro,
  torneo,
  confirmado,
  registroId,
  transaction = null,
}) {
  if (!organizadorId) return null;

  const nombreArbitro = displayName(arbitro);
  const nombreTorneo = torneo?.nombre || 'el torneo';
  const verbo = confirmado ? 'aceptó' : 'rechazó';

  return crearNotificacion({
    usuarioId: organizadorId,
    tipo: TIPOS_NOTIFICACION.RESPUESTA_INVITACION_CUERPO_ARBITRAL,
    mensaje: `**${nombreArbitro}** ${verbo} unirse al cuerpo arbitral de **${nombreTorneo}**`,
    referenciaId: registroId,
    referenciaTipo: 'TORNEO_ARBITRO',
    transaction,
  });
}

export async function notificarAsignacionArbitro({
  partidoId,
  arbitroId,
  torneo,
  transaction = null,
}) {
  if (!arbitroId) return null;

  const nombreTorneo = torneo?.nombre || 'un torneo';

  return crearNotificacion({
    usuarioId: arbitroId,
    tipo: TIPOS_NOTIFICACION.ASIGNACION_ARBITRO,
    mensaje: `Te asignaron como árbitro de un partido en **${nombreTorneo}**`,
    referenciaId: partidoId,
    referenciaTipo: 'PARTIDO',
    transaction,
  });
}

export async function notificarNominaPropuesta({
  partidoId,
  arbitroId,
  equipo,
  setNumero = 1,
  transaction = null,
}) {
  if (!arbitroId) return null;

  const nombreEquipo = equipo?.name || 'Un equipo';
  const setLabel = setNumero > 1 ? ` del Set ${setNumero}` : '';

  return crearNotificacion({
    usuarioId: arbitroId,
    tipo: TIPOS_NOTIFICACION.NOMINA_PROPUESTA,
    mensaje: `**${nombreEquipo}** envió la alineación${setLabel} para validar`,
    referenciaId: partidoId,
    referenciaTipo: setNumero > 1 ? `PARTIDO_NOMINA_SET:${setNumero}` : 'PARTIDO',
    transaction,
  });
}

export async function notificarAlineacionPendienteSet({
  partidoId,
  setNumero,
  transaction = null,
}) {
  if (!partidoId || !setNumero || setNumero <= 1) return [];

  const partido = await Partidos.findByPk(partidoId, {
    attributes: ['id', 'state', 'torneo_id'],
    include: [{
      model: Torneos,
      as: 'torneo',
      attributes: ['id', 'nombre'],
    }],
    transaction,
  });

  if (!partido || partido.state !== 'EN_CURSO') return [];

  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partidoId },
    attributes: ['team_id', 'es_local'],
    include: [{
      model: Team,
      as: 'equipo',
      attributes: ['id', 'name', 'capitan_id'],
    }],
    transaction,
  });

  if (participantes.length < 2) return [];

  const setTerminado = setNumero - 1;
  const nombreTorneo = partido.torneo?.nombre || 'el torneo';
  const created = [];

  for (const participante of participantes) {
    const capitanId = participante.equipo?.capitan_id;
    if (!capitanId) continue;

    const rival = participantes.find((p) => p.team_id !== participante.team_id);
    const nombreRival = rival?.equipo?.name || 'tu rival';
    const mensaje = `**Termina el Set ${setTerminado}** · Configura tu alineación para el Set ${setNumero} vs **${nombreRival}** · **${nombreTorneo}**`;

    const notif = await crearNotificacion({
      usuarioId: capitanId,
      tipo: TIPOS_NOTIFICACION.ALINEACION_PENDIENTE_SET,
      mensaje,
      referenciaId: partidoId,
      referenciaTipo: `PARTIDO_ALINEACION_SET:${setNumero}:${participante.team_id}`,
      transaction,
    });
    if (notif) created.push(notif);
  }

  return created;
}

export async function notificarResultadoPartido(partidoId, transaction = null) {
  const partido = await Partidos.findByPk(partidoId, {
    attributes: [
      'id',
      'score_local_final',
      'score_visitante_final',
      'torneo_id',
    ],
    transaction,
  });

  if (!partido) return [];

  const participantes = await PartidoParticipantes.findAll({
    where: { partido_id: partidoId },
    attributes: ['team_id', 'es_local'],
    include: [{
      model: Team,
      as: 'equipo',
      attributes: ['id', 'name'],
    }],
    transaction,
  });

  if (!participantes.length) return [];

  const local = participantes.find((p) => p.es_local);
  const visitante = participantes.find((p) => !p.es_local);
  const nombreLocal = local?.equipo?.name || 'Local';
  const nombreVisitante = visitante?.equipo?.name || 'Visitante';
  const marcador = `${partido.score_local_final ?? 0}-${partido.score_visitante_final ?? 0}`;

  const teamIds = participantes.map((p) => p.team_id).filter(Boolean);
  const miembros = await TeamMiembros.findAll({
    where: {
      team_id: teamIds,
      estado_invitacion: 'ACEPTADO',
    },
    attributes: ['user_id'],
    transaction,
  });

  const destinatarios = [...new Set(miembros.map((m) => m.user_id))];
  const mensaje = `Finalizó **${nombreLocal}** vs **${nombreVisitante}** (${marcador})`;

  const created = [];
  for (const usuarioId of destinatarios) {
    const notif = await crearNotificacion({
      usuarioId,
      tipo: TIPOS_NOTIFICACION.RESULTADO_PARTIDO,
      mensaje,
      referenciaId: partidoId,
      referenciaTipo: 'PARTIDO',
      transaction,
    });
    if (notif) created.push(notif);
  }

  return created;
}

export async function notificarNuevoSeguidor({
  seguidorId,
  seguidoUserId,
  seguidorUser,
  transaction = null,
}) {
  if (!seguidoUserId || seguidorId === seguidoUserId) return null;

  const nombreSeguidor = displayName(seguidorUser);

  return crearNotificacion({
    usuarioId: seguidoUserId,
    tipo: TIPOS_NOTIFICACION.NUEVO_SEGUIDOR,
    mensaje: `**${nombreSeguidor}** comenzó a seguirte`,
    referenciaId: seguidorId,
    referenciaTipo: 'USUARIO',
    transaction,
  });
}

export async function notificarInscripcionAceptada({
  inscripcionId,
  torneo,
  capitanId,
  transaction = null,
}) {
  const destinatarioId = capitanId;
  if (!destinatarioId) return null;

  const nombreTorneo = torneo?.nombre || 'el torneo';

  return crearNotificacion({
    usuarioId: destinatarioId,
    tipo: TIPOS_NOTIFICACION.INSCRIPCION_ACEPTADA,
    mensaje: `Tu equipo fue aceptado en **${nombreTorneo}**`,
    referenciaId: inscripcionId,
    referenciaTipo: 'TORNEO_INSCRIPCION',
    transaction,
  });
}

export async function notificarInscripcionRechazada({
  inscripcionId,
  torneo,
  capitanId,
  transaction = null,
}) {
  if (!capitanId) return null;

  const nombreTorneo = torneo?.nombre || 'el torneo';

  return crearNotificacion({
    usuarioId: capitanId,
    tipo: TIPOS_NOTIFICACION.INSCRIPCION_RECHAZADA,
    mensaje: `Tu equipo fue rechazado en **${nombreTorneo}**`,
    referenciaId: inscripcionId,
    referenciaTipo: 'TORNEO_INSCRIPCION',
    transaction,
  });
}

export async function notificarRespuestaInvitacionEquipo({
  capitanId,
  jugador,
  equipo,
  aceptado,
  membresiaId,
  transaction = null,
}) {
  if (!capitanId) return null;

  const nombreJugador = displayName(jugador);
  const nombreEquipo = equipo?.name || 'tu equipo';
  const verbo = aceptado ? 'aceptó' : 'rechazó';

  return crearNotificacion({
    usuarioId: capitanId,
    tipo: TIPOS_NOTIFICACION.RESPUESTA_INVITACION_EQUIPO,
    mensaje: `**${nombreJugador}** ${verbo} tu invitación a **${nombreEquipo}**`,
    referenciaId: membresiaId,
    referenciaTipo: 'TEAM_MIEMBRO',
    transaction,
  });
}

export async function notificarRespuestaInvitacionTorneo({
  organizadorId,
  equipo,
  torneo,
  aceptada,
  inscripcionId,
  transaction = null,
}) {
  if (!organizadorId) return null;

  const nombreEquipo = equipo?.name || 'Un equipo';
  const nombreTorneo = torneo?.nombre || 'el torneo';
  const verbo = aceptada ? 'aceptó' : 'rechazó';

  return crearNotificacion({
    usuarioId: organizadorId,
    tipo: TIPOS_NOTIFICACION.RESPUESTA_INVITACION_TORNEO,
    mensaje: `**${nombreEquipo}** ${verbo} participar en **${nombreTorneo}**`,
    referenciaId: inscripcionId,
    referenciaTipo: 'TORNEO_INSCRIPCION',
    transaction,
  });
}

export async function notificarRespuestaAsignacionArbitro({
  organizadorId,
  arbitro,
  partidoId,
  nombreLocal,
  nombreVisitante,
  confirmado,
  transaction = null,
}) {
  if (!organizadorId) return null;

  const nombreArbitro = displayName(arbitro);
  const enfrentamiento = `${nombreLocal} vs ${nombreVisitante}`;
  const verbo = confirmado ? 'confirmó' : 'rechazó';

  return crearNotificacion({
    usuarioId: organizadorId,
    tipo: TIPOS_NOTIFICACION.RESPUESTA_ASIGNACION_ARBITRO,
    mensaje: `**${nombreArbitro}** ${verbo} arbitrar **${enfrentamiento}**`,
    referenciaId: partidoId,
    referenciaTipo: 'PARTIDO',
    transaction,
  });
}

export async function notificarEtiquetaPendiente({
  etiquetaId,
  usuarioEtiquetadoId,
  autor,
  transaction = null,
}) {
  const nombreAutor = displayName(autor);

  return crearNotificacion({
    usuarioId: usuarioEtiquetadoId,
    tipo: TIPOS_NOTIFICACION.ETIQUETA_PENDIENTE,
    mensaje: `**${nombreAutor}** te etiquetó en una publicación`,
    referenciaId: etiquetaId,
    referenciaTipo: 'PUBLICACION_ETIQUETA',
    transaction,
  });
}

async function resolverNavegacion(notificacion) {
  const base = {
    tipo: notificacion.tipo,
    referencia_id: notificacion.referencia_id,
    referencia_tipo: notificacion.referencia_tipo,
  };

  switch (notificacion.tipo) {
    case TIPOS_NOTIFICACION.INVITACION_EQUIPO: {
      const membresia = await TeamMiembros.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'team_id'],
      });
      return {
        ...base,
        destino: 'InvitacionEquipo',
        params: {
          teamId: membresia?.team_id,
          miembroId: notificacion.referencia_id,
        },
      };
    }
    case TIPOS_NOTIFICACION.SOLICITUD_INSCRIPCION: {
      const inscripcion = await TorneoInscripcion.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'torneo_id'],
      });
      return {
        ...base,
        destino: 'SolicitudInscripcion',
        params: {
          torneoId: inscripcion?.torneo_id,
          inscripcionId: notificacion.referencia_id,
        },
      };
    }
    case TIPOS_NOTIFICACION.ASIGNACION_ARBITRO:
      return {
        ...base,
        destino: 'AsignacionArbitro',
        params: { partidoId: notificacion.referencia_id },
      };
    case TIPOS_NOTIFICACION.INVITACION_CUERPO_ARBITRAL: {
      const registro = await TorneoArbitros.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'torneo_id'],
      });
      return {
        ...base,
        destino: 'InvitacionCuerpoArbitral',
        params: {
          torneoId: registro?.torneo_id,
          registroId: notificacion.referencia_id,
        },
      };
    }
    case TIPOS_NOTIFICACION.RESPUESTA_INVITACION_CUERPO_ARBITRAL: {
      const registro = await TorneoArbitros.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'torneo_id'],
      });
      return {
        ...base,
        destino: 'TorneoArbitros',
        params: { torneoId: registro?.torneo_id },
      };
    }
    case TIPOS_NOTIFICACION.RESPUESTA_INVITACION_EQUIPO: {
      const membresia = await TeamMiembros.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'team_id'],
      });
      return {
        ...base,
        destino: 'EquipoDetail',
        params: { teamId: membresia?.team_id },
      };
    }
    case TIPOS_NOTIFICACION.RESPUESTA_INVITACION_TORNEO:
    case TIPOS_NOTIFICACION.INSCRIPCION_ACEPTADA:
    case TIPOS_NOTIFICACION.INSCRIPCION_RECHAZADA: {
      const inscripcion = await TorneoInscripcion.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'torneo_id'],
      });
      return {
        ...base,
        destino: 'PerfilPublicoTorneo',
        params: { torneoId: inscripcion?.torneo_id },
      };
    }
    case TIPOS_NOTIFICACION.RESPUESTA_ASIGNACION_ARBITRO: {
      const partido = await Partidos.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'torneo_id'],
      });
      return {
        ...base,
        destino: 'TorneoArbitros',
        params: { torneoId: partido?.torneo_id },
      };
    }
    case TIPOS_NOTIFICACION.NOMINA_PROPUESTA: {
      const partido = await Partidos.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'state'],
      });
      if (partido?.state === 'EN_CURSO') {
        const parts = (notificacion.referencia_tipo || '').split(':');
        const setNumero = parseInt(parts[1], 10) || null;
        return {
          ...base,
          destino: 'PartidoEnVivo',
          params: {
            partidoId: notificacion.referencia_id,
            ...(setNumero ? { pendienteValidacionSet: setNumero } : {}),
          },
        };
      }
      return {
        ...base,
        destino: 'PartidoDetalle',
        params: { partidoId: notificacion.referencia_id },
      };
    }
    case TIPOS_NOTIFICACION.ALINEACION_PENDIENTE_SET: {
      const parts = (notificacion.referencia_tipo || '').split(':');
      const setNumero = parseInt(parts[1], 10) || null;
      const teamId = parseInt(parts[2], 10) || null;
      return {
        ...base,
        destino: 'PartidoEnVivo',
        params: {
          partidoId: notificacion.referencia_id,
          abrirAlineacion: true,
          setNumero,
          teamId,
        },
      };
    }
    case TIPOS_NOTIFICACION.RESULTADO_PARTIDO:
      return {
        ...base,
        destino: 'PartidoResultadoFinal',
        params: { partidoId: notificacion.referencia_id },
      };
    case TIPOS_NOTIFICACION.NUEVO_SEGUIDOR:
      return {
        ...base,
        destino: 'PerfilPublico',
        params: { userId: notificacion.referencia_id },
      };
    case TIPOS_NOTIFICACION.ETIQUETA_PENDIENTE: {
      const etiqueta = await PublicacionEtiquetas.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'publicacion_id'],
      });
      return {
        ...base,
        destino: 'PublicacionDetail',
        params: {
          mode: 'feed',
          publicacion: { id: etiqueta?.publicacion_id },
          focusEtiqueta: true,
        },
      };
    }
    default:
      return { ...base, destino: null, params: {} };
  }
}

function serializarNotificacion(json, navegacion) {
  return {
    id: json.id,
    tipo: json.tipo,
    categoria: json.categoria,
    mensaje: json.mensaje,
    leida: json.leida,
    created_at: json.created_at,
    referencia_id: json.referencia_id,
    referencia_tipo: json.referencia_tipo,
    navegacion,
  };
}

export async function listarNotificacionesUsuario(
  usuarioId,
  { limit = 50, offset = 0, categoria = null } = {}
) {
  const where = { usuario_id: usuarioId };
  if (categoria) {
    where.categoria = categoria;
  }

  const rows = await Notificaciones.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  const notificaciones = await Promise.all(rows.map(async (row) => {
    const json = row.toJSON();
    const navegacion = await resolverNavegacion(json);
    return serializarNotificacion(json, navegacion);
  }));

  return {
    notificaciones,
    categorias: listarCategoriasDisponibles(),
  };
}

export function validarCategoriaFiltro(categoria) {
  if (!categoria) return null;
  if (!esCategoriaValida(categoria)) {
    throw new Error('Categoría de notificación inválida');
  }
  return categoria;
}

export async function contarNoLeidas(usuarioId) {
  return Notificaciones.count({
    where: { usuario_id: usuarioId, leida: false },
  });
}

export async function marcarNotificacionLeida(notificacionId, usuarioId) {
  const notificacion = await Notificaciones.findOne({
    where: { id: notificacionId, usuario_id: usuarioId },
  });

  if (!notificacion) return null;

  if (!notificacion.leida) {
    await notificacion.update({ leida: true });
  }

  const json = notificacion.toJSON();
  const navegacion = await resolverNavegacion(json);

  return serializarNotificacion({ ...json, leida: true }, navegacion);
}

export async function marcarTodasLeidas(usuarioId) {
  await Notificaciones.update(
    { leida: true },
    { where: { usuario_id: usuarioId, leida: false } }
  );
  return contarNoLeidas(usuarioId);
}

export async function eliminarNotificacion(notificacionId, usuarioId) {
  const notificacion = await Notificaciones.findOne({
    where: { id: notificacionId, usuario_id: usuarioId },
  });

  if (!notificacion) return null;

  const eraNoLeida = !notificacion.leida;
  await notificacion.destroy();

  return { id: notificacionId, eraNoLeida };
}
