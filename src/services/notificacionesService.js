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
  ClubSolicitudes,
  ClubMembresiaSolicitudes,
  ClubDivisiones,
  ClubAnuncios,
  ClubDivisionInvitaciones,
  ClubEventos,
  ContenidoComentarios,
} from '../db/db.js';
import {
  categoriaDeTipo,
  esCategoriaValida,
  listarCategoriasDisponibles,
} from '../constants/notificacionCategorias.js';
import { emitNuevaNotificacion } from '../socket/partidoSocket.js';
import { enviarPushNotificacionUsuario } from './pushNotificationService.js';
import { esPracticaInterna } from './partidoAmistosoService.js';

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
  SOLICITUD_CLUB: 'SOLICITUD_CLUB',
  CLUB_ACEPTADA: 'CLUB_ACEPTADA',
  CLUB_RECHAZADA: 'CLUB_RECHAZADA',
  SOLICITUD_MEMBRESIA_CLUB: 'SOLICITUD_MEMBRESIA_CLUB',
  MEMBRESIA_CLUB_ACEPTADA: 'MEMBRESIA_CLUB_ACEPTADA',
  MEMBRESIA_CLUB_RECHAZADA: 'MEMBRESIA_CLUB_RECHAZADA',
  ANUNCIO_CLUB: 'ANUNCIO_CLUB',
  INVITACION_CLUB_DIVISION: 'INVITACION_CLUB_DIVISION',
  RESPUESTA_INVITACION_CLUB_DIVISION: 'RESPUESTA_INVITACION_CLUB_DIVISION',
  CONVOCATORIA_ENTRENAMIENTO: 'CONVOCATORIA_ENTRENAMIENTO',
  ENTRENAMIENTO_FINALIZADO: 'ENTRENAMIENTO_FINALIZADO',
  COMENTARIO_AVISO: 'COMENTARIO_AVISO',
  COMENTARIO_PUBLICACION: 'COMENTARIO_PUBLICACION',
  REACCION_AVISO: 'REACCION_AVISO',
  REACCION_PUBLICACION: 'REACCION_PUBLICACION',
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

    // Nunca bloquear el request HTTP esperando Expo/FCM: si el push tarda o cuelga,
    // el cliente aborta y muestra "Error de conexión" aunque el write ya se guardó.
    void enviarPushNotificacionUsuario(usuarioId, {
      notificacion: notificacionSerializada,
      navegacion,
    }).catch((error) => {
      console.error('Error enviando push (async):', error);
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
      vista_bandeja: false,
    },
    { transaction }
  );

  if (!row) return null;

  // Publicar socket/push fuera del camino crítico de la respuesta HTTP.
  const schedulePublish = () => {
    void publicarNotificacionEnVivo(row, usuarioId).catch((error) => {
      console.error('Error publicando notificación (async):', error);
    });
  };

  if (transaction) {
    transaction.afterCommit(schedulePublish);
  } else {
    schedulePublish();
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

  // Fogueo / práctica interna: el entrenador es árbitro y rearma en cancha.
  // No notificar "configura nómina" como en torneo.
  if (esPracticaInterna(participantes)) return [];

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

export async function notificarSolicitudClub({
  solicitudId,
  club,
  division,
  equipo,
  transaction = null,
}) {
  const destinatarios = new Set();
  if (club?.admin_id) destinatarios.add(club.admin_id);
  if (division?.encargado_id) destinatarios.add(division.encargado_id);

  const nombreEquipo = equipo?.name || 'Un equipo';
  const nombreClub = club?.nombre || 'tu club';
  const sufijoDivision = division?.nombre ? ` (${division.nombre})` : '';

  const results = [];
  for (const usuarioId of destinatarios) {
    const row = await crearNotificacion({
      usuarioId,
      tipo: TIPOS_NOTIFICACION.SOLICITUD_CLUB,
      mensaje: `**${nombreEquipo}** solicitó unirse a **${nombreClub}**${sufijoDivision}`,
      referenciaId: solicitudId,
      referenciaTipo: 'CLUB_SOLICITUD',
      transaction,
    });
    if (row) results.push(row);
  }
  return results;
}

export async function notificarClubAceptada({
  solicitudId,
  club,
  capitanId,
  transaction = null,
}) {
  if (!capitanId) return null;
  const nombreClub = club?.nombre || 'el club';
  return crearNotificacion({
    usuarioId: capitanId,
    tipo: TIPOS_NOTIFICACION.CLUB_ACEPTADA,
    mensaje: `Tu equipo fue aceptado en **${nombreClub}**`,
    referenciaId: solicitudId,
    referenciaTipo: 'CLUB_SOLICITUD',
    transaction,
  });
}

export async function notificarClubRechazada({
  solicitudId,
  club,
  capitanId,
  transaction = null,
}) {
  if (!capitanId) return null;
  const nombreClub = club?.nombre || 'el club';
  return crearNotificacion({
    usuarioId: capitanId,
    tipo: TIPOS_NOTIFICACION.CLUB_RECHAZADA,
    mensaje: `Tu equipo fue rechazado en **${nombreClub}**`,
    referenciaId: solicitudId,
    referenciaTipo: 'CLUB_SOLICITUD',
    transaction,
  });
}

export async function notificarSolicitudMembresiaClub({
  solicitudId,
  club,
  solicitante,
  transaction = null,
}) {
  if (!club?.admin_id) return null;
  const nombre = displayName(solicitante);
  const nombreClub = club?.nombre || 'tu club';

  return crearNotificacion({
    usuarioId: club.admin_id,
    tipo: TIPOS_NOTIFICACION.SOLICITUD_MEMBRESIA_CLUB,
    mensaje: `**${nombre}** solicitó unirse a **${nombreClub}** con código`,
    referenciaId: solicitudId,
    referenciaTipo: 'CLUB_MEMBRESIA_SOLICITUD',
    transaction,
  });
}

export async function notificarMembresiaClubAceptada({
  solicitudId,
  club,
  usuarioId,
  rolMembresia,
  transaction = null,
}) {
  if (!usuarioId) return null;
  const nombreClub = club?.nombre || 'el club';
  const rol = rolMembresia ? ` como ${String(rolMembresia).toLowerCase().replace(/_/g, ' ')}` : '';
  return crearNotificacion({
    usuarioId,
    tipo: TIPOS_NOTIFICACION.MEMBRESIA_CLUB_ACEPTADA,
    mensaje: `Te aceptaron en **${nombreClub}**${rol}`,
    referenciaId: solicitudId,
    referenciaTipo: 'CLUB_MEMBRESIA_SOLICITUD',
    transaction,
  });
}

export async function notificarMembresiaClubRechazada({
  solicitudId,
  club,
  usuarioId,
  transaction = null,
}) {
  if (!usuarioId) return null;
  const nombreClub = club?.nombre || 'el club';
  return crearNotificacion({
    usuarioId,
    tipo: TIPOS_NOTIFICACION.MEMBRESIA_CLUB_RECHAZADA,
    mensaje: `Tu solicitud para unirte a **${nombreClub}** fue rechazada`,
    referenciaId: solicitudId,
    referenciaTipo: 'CLUB_MEMBRESIA_SOLICITUD',
    transaction,
  });
}

export async function notificarAnuncioClub({ anuncio, destinatarios = [], transaction = null }) {
  if (!anuncio?.id || !destinatarios.length) return [];

  const prefix = anuncio.importancia === 'IMPORTANTE' ? '⚠️ ' : '';
  const mensaje = `${prefix}**${anuncio.titulo}** — nuevo comunicado del club`;

  const results = [];
  for (const usuarioId of destinatarios) {
    const row = await crearNotificacion({
      usuarioId,
      tipo: TIPOS_NOTIFICACION.ANUNCIO_CLUB,
      mensaje,
      referenciaId: anuncio.id,
      referenciaTipo: 'CLUB_ANUNCIO',
      transaction,
    });
    if (row) results.push(row);
  }
  return results;
}

export async function notificarComentarioPublicacion({
  publicacionId,
  autorPublicacionId,
  comentarista,
  comentarioId,
  transaction = null,
}) {
  if (!autorPublicacionId || !publicacionId) return null;
  const nombre = displayName(comentarista);
  return crearNotificacion({
    usuarioId: autorPublicacionId,
    tipo: TIPOS_NOTIFICACION.COMENTARIO_PUBLICACION,
    mensaje: `**${nombre}** comentó tu publicación`,
    referenciaId: comentarioId ?? publicacionId,
    referenciaTipo: 'CONTENIDO_COMENTARIO',
    transaction,
  });
}

export async function notificarComentarioAviso({
  anuncioId,
  autorAvisoId,
  comentarista,
  comentarioId,
  transaction = null,
}) {
  if (!autorAvisoId || !anuncioId) return null;
  const nombre = displayName(comentarista);
  return crearNotificacion({
    usuarioId: autorAvisoId,
    tipo: TIPOS_NOTIFICACION.COMENTARIO_AVISO,
    mensaje: `**${nombre}** comentó tu aviso del club`,
    referenciaId: comentarioId ?? anuncioId,
    referenciaTipo: 'CONTENIDO_COMENTARIO',
    transaction,
  });
}

export async function notificarReaccionPublicacion({
  publicacionId,
  autorPublicacionId,
  actor,
  tipoReaccion,
  transaction = null,
}) {
  if (!autorPublicacionId || !publicacionId) return null;
  const nombre = displayName(actor);
  return crearNotificacion({
    usuarioId: autorPublicacionId,
    tipo: TIPOS_NOTIFICACION.REACCION_PUBLICACION,
    mensaje: `**${nombre}** reaccionó a tu publicación`,
    referenciaId: publicacionId,
    referenciaTipo: 'PUBLICACION',
    transaction,
  });
}

export async function notificarReaccionAviso({
  anuncioId,
  autorAvisoId,
  actor,
  tipoReaccion,
  transaction = null,
}) {
  if (!autorAvisoId || !anuncioId) return null;
  const nombre = displayName(actor);
  return crearNotificacion({
    usuarioId: autorAvisoId,
    tipo: TIPOS_NOTIFICACION.REACCION_AVISO,
    mensaje: `**${nombre}** reaccionó a tu aviso del club`,
    referenciaId: anuncioId,
    referenciaTipo: 'CLUB_ANUNCIO',
    transaction,
  });
}

export async function notificarInvitacionClubDivision({
  invitacionId,
  usuarioInvitadoId,
  invitador,
  club,
  division,
  transaction = null,
}) {
  const nombreInvitador = displayName(invitador);
  const nombreClub = club?.nombre || 'un club';
  const nombreDivision = division?.nombre || 'una división';

  return crearNotificacion({
    usuarioId: usuarioInvitadoId,
    tipo: TIPOS_NOTIFICACION.INVITACION_CLUB_DIVISION,
    mensaje: `**${nombreInvitador}** te invitó a unirte a **${nombreDivision}** de **${nombreClub}**`,
    referenciaId: invitacionId,
    referenciaTipo: 'CLUB_DIVISION_INVITACION',
    transaction,
  });
}

export async function notificarRespuestaInvitacionClubDivision({
  invitadorId,
  jugador,
  division,
  aceptada,
  invitacionId,
  transaction = null,
}) {
  if (!invitadorId) return null;

  const nombreJugador = displayName(jugador);
  const nombreDivision = division?.nombre || 'la división';
  const verbo = aceptada ? 'aceptó unirse a' : 'rechazó unirse a';

  return crearNotificacion({
    usuarioId: invitadorId,
    tipo: TIPOS_NOTIFICACION.RESPUESTA_INVITACION_CLUB_DIVISION,
    mensaje: `**${nombreJugador}** ${verbo} **${nombreDivision}**`,
    referenciaId: invitacionId,
    referenciaTipo: 'CLUB_DIVISION_INVITACION',
    transaction,
  });
}

export async function notificarConvocatoriaEntrenamiento({
  eventoId,
  club,
  division,
  evento,
  destinatarioIds = [],
  transaction = null,
}) {
  const nombreClub = club?.nombre || 'tu club';
  const nombreDivision = division?.nombre || 'tu división';
  const fecha = evento?.fecha_hora
    ? new Date(evento.fecha_hora).toLocaleString('es-CO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    : 'próximamente';

  const results = [];
  for (const usuarioId of destinatarioIds) {
    const row = await crearNotificacion({
      usuarioId,
      tipo: TIPOS_NOTIFICACION.CONVOCATORIA_ENTRENAMIENTO,
      mensaje: `Entrenamiento en **${nombreDivision}** (${nombreClub}) — ${fecha}. Confirma tu asistencia.`,
      referenciaId: eventoId,
      referenciaTipo: 'CLUB_EVENTO',
      transaction,
    });
    if (row) results.push(row);
  }
  return results;
}

export async function notificarEntrenamientoFinalizado({
  eventoId,
  clubNombre,
  divisionNombre,
  scoreLocal = null,
  scoreVisitante = null,
  fogueoFinalizado = false,
  destinatarios = [],
  transaction = null,
}) {
  if (!eventoId || !Array.isArray(destinatarios) || destinatarios.length === 0) {
    return [];
  }

  const nombreClub = clubNombre || 'tu club';
  const nombreDivision = divisionNombre || 'tu división';
  const hayMarcador = scoreLocal != null && scoreVisitante != null;
  const marcadorTxt = hayMarcador
    ? ` · Fogueo Equipo A ${scoreLocal}–${scoreVisitante} Equipo B`
    : (fogueoFinalizado ? ' · Fogueo cerrado' : '');

  const results = [];
  for (const dest of destinatarios) {
    const usuarioId = dest?.usuarioId ?? dest?.usuario_id ?? dest;
    if (!usuarioId) continue;

    const promedio = dest?.promedio != null && Number.isFinite(Number(dest.promedio))
      ? Number(dest.promedio)
      : null;
    const califTxt = promedio != null
      ? ` Tu calificación: **${promedio.toFixed(1)}/10**.`
      : ' Revisa el detalle del entrenamiento.';

    const row = await crearNotificacion({
      usuarioId,
      tipo: TIPOS_NOTIFICACION.ENTRENAMIENTO_FINALIZADO,
      mensaje: `**Entrenamiento finalizado** · ${nombreDivision} (${nombreClub})${marcadorTxt}.${califTxt}`,
      referenciaId: eventoId,
      referenciaTipo: 'CLUB_EVENTO',
      transaction,
    });
    if (row) results.push(row);
  }
  return results;
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
    case TIPOS_NOTIFICACION.SOLICITUD_CLUB: {
      const solicitud = await ClubSolicitudes.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'club_id'],
      });
      return {
        ...base,
        destino: 'SolicitudClub',
        params: {
          clubId: solicitud?.club_id,
          solicitudId: notificacion.referencia_id,
        },
      };
    }
    case TIPOS_NOTIFICACION.SOLICITUD_MEMBRESIA_CLUB: {
      const solicitud = await ClubMembresiaSolicitudes.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'club_id'],
      });
      return {
        ...base,
        destino: 'ClubMembresiaSolicitud',
        params: {
          clubId: solicitud?.club_id,
          solicitudId: notificacion.referencia_id,
        },
      };
    }
    case TIPOS_NOTIFICACION.CLUB_ACEPTADA:
    case TIPOS_NOTIFICACION.CLUB_RECHAZADA: {
      const solicitud = await ClubSolicitudes.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'club_id'],
      });
      return {
        ...base,
        destino: 'PerfilPublicoClub',
        params: { clubId: solicitud?.club_id },
      };
    }
    case TIPOS_NOTIFICACION.MEMBRESIA_CLUB_ACEPTADA:
    case TIPOS_NOTIFICACION.MEMBRESIA_CLUB_RECHAZADA: {
      const solicitud = await ClubMembresiaSolicitudes.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'club_id'],
      });
      return {
        ...base,
        destino: 'PerfilPublicoClub',
        params: { clubId: solicitud?.club_id },
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
    case TIPOS_NOTIFICACION.INVITACION_CLUB_DIVISION: {
      const invitacion = await ClubDivisionInvitaciones.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'club_division_id'],
        include: [{
          model: ClubDivisiones,
          as: 'division',
          attributes: ['id', 'club_id'],
        }],
      });
      return {
        ...base,
        destino: 'InvitacionClubDivision',
        params: {
          clubId: invitacion?.division?.club_id,
          divisionId: invitacion?.club_division_id,
          invitacionId: notificacion.referencia_id,
        },
      };
    }
    case TIPOS_NOTIFICACION.RESPUESTA_INVITACION_CLUB_DIVISION: {
      const invitacion = await ClubDivisionInvitaciones.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'club_division_id'],
        include: [{
          model: ClubDivisiones,
          as: 'division',
          attributes: ['id', 'club_id'],
        }],
      });
      return {
        ...base,
        destino: 'ClubDivisionDetalle',
        params: {
          clubId: invitacion?.division?.club_id,
          divisionId: invitacion?.club_division_id,
        },
      };
    }
    case TIPOS_NOTIFICACION.CONVOCATORIA_ENTRENAMIENTO:
    case TIPOS_NOTIFICACION.ENTRENAMIENTO_FINALIZADO: {
      const evento = await ClubEventos.findByPk(notificacion.referencia_id, {
        attributes: ['id', 'club_division_id'],
        include: [{
          model: ClubDivisiones,
          as: 'division',
          attributes: ['id', 'club_id'],
        }],
      });
      return {
        ...base,
        destino: 'EntrenamientoClubDetalle',
        params: {
          clubId: evento?.division?.club_id,
          eventoId: notificacion.referencia_id,
          divisionId: evento?.club_division_id,
        },
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
    case TIPOS_NOTIFICACION.COMENTARIO_PUBLICACION: {
      let publicacionId = null;
      if (notificacion.referencia_tipo === 'CONTENIDO_COMENTARIO') {
        const comentario = await ContenidoComentarios.findByPk(notificacion.referencia_id, {
          attributes: ['id', 'contenido_id', 'contenido_tipo'],
        });
        if (comentario?.contenido_tipo === 'PUBLICACION') {
          publicacionId = comentario.contenido_id;
        }
      }
      return {
        ...base,
        destino: 'PublicacionDetail',
        params: {
          mode: 'feed',
          publicacion: publicacionId ? { id: publicacionId } : undefined,
        },
      };
    }
    case TIPOS_NOTIFICACION.REACCION_PUBLICACION: {
      const publicacionId = notificacion.referencia_tipo === 'PUBLICACION'
        ? notificacion.referencia_id
        : null;
      return {
        ...base,
        destino: 'PublicacionDetail',
        params: {
          mode: 'feed',
          publicacion: publicacionId ? { id: publicacionId } : undefined,
        },
      };
    }
    case TIPOS_NOTIFICACION.COMENTARIO_AVISO:
    case TIPOS_NOTIFICACION.REACCION_AVISO:
    case TIPOS_NOTIFICACION.ANUNCIO_CLUB: {
      let anuncioId = null;
      if (notificacion.tipo === TIPOS_NOTIFICACION.COMENTARIO_AVISO
        && notificacion.referencia_tipo === 'CONTENIDO_COMENTARIO') {
        const comentario = await ContenidoComentarios.findByPk(notificacion.referencia_id, {
          attributes: ['id', 'contenido_id', 'contenido_tipo'],
        });
        if (comentario?.contenido_tipo === 'AVISO') {
          anuncioId = comentario.contenido_id;
        }
      } else if (
        notificacion.referencia_tipo === 'CLUB_ANUNCIO'
        || notificacion.tipo === TIPOS_NOTIFICACION.REACCION_AVISO
        || notificacion.tipo === TIPOS_NOTIFICACION.ANUNCIO_CLUB
      ) {
        anuncioId = notificacion.referencia_id;
      }

      const anuncio = anuncioId
        ? await ClubAnuncios.findByPk(anuncioId, { attributes: ['id', 'club_id'] })
        : null;
      return {
        ...base,
        destino: 'AvisoDetail',
        params: {
          clubId: anuncio?.club_id,
          anuncioId: anuncio?.id,
          openComments: notificacion.tipo === TIPOS_NOTIFICACION.COMENTARIO_AVISO,
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
    vista_bandeja: Boolean(json.vista_bandeja),
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

/**
 * Contador del badge del bottom nav.
 * Usa vista_bandeja (no leida): se limpia al entrar a la bandeja,
 * sin quitar el indicador visual de no leída en la lista.
 */
export async function contarNoLeidas(usuarioId) {
  return Notificaciones.count({
    where: { usuario_id: usuarioId, vista_bandeja: false },
  });
}

export async function marcarNotificacionLeida(notificacionId, usuarioId) {
  const notificacion = await Notificaciones.findOne({
    where: { id: notificacionId, usuario_id: usuarioId },
  });

  if (!notificacion) return null;

  const patch = {};
  if (!notificacion.leida) patch.leida = true;
  if (!notificacion.vista_bandeja) patch.vista_bandeja = true;
  if (Object.keys(patch).length) {
    await notificacion.update(patch);
  }

  const json = notificacion.toJSON();
  const navegacion = await resolverNavegacion(json);

  return serializarNotificacion({ ...json, leida: true, vista_bandeja: true }, navegacion);
}

/** Resetea el badge al abrir la pantalla de Notificaciones. No marca leida. */
export async function marcarVistaBandeja(usuarioId) {
  await Notificaciones.update(
    { vista_bandeja: true },
    { where: { usuario_id: usuarioId, vista_bandeja: false } }
  );
  return contarNoLeidas(usuarioId);
}

export async function marcarTodasLeidas(usuarioId) {
  await Notificaciones.update(
    { leida: true, vista_bandeja: true },
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
