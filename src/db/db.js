import { Sequelize } from 'sequelize';
import sequelize from '../config/database.js';

// ============================================
// IMPORTAR Y DEFINIR TODOS LOS MODELOS
// ============================================

import usuariosModel from './models/usuarios.js';
import complejosModel from './models/complejos.js';
import canchasModel from './models/canchas.js';
import detailsCanchasModel from './models/detailsCanchas.js';
import wallpaperCanchasModel from './models/WallpaperCanchas.js';

import complejoHorariosModel from './models/complejo_horarios.js';
import canchaHorariosPreciosModel from './models/cancha_horarios_precios.js';
import calendarioExcepcionesModel from './models/calendario_excepciones.js';
import configuracionHorariosFavoritosModel from './models/configuracion_horarios_favoritos.js';

import userModel from './models/user.js';
import sportsModel from './models/sports.js';
import reservasModel from './models/reservas.js';
import usuarioStatsPorSportModel from './models/usuario_stats_por_sport.js';

import partidosModel from './models/partidos.js';
import partidoConfirmacionesModel from './models/partido_confirmaciones.js';
import partidoParticipantesModel from './models/Partido_Participantes.js';
import partidoJugadorStatsModel from './models/partido_jugador_stats.js';
import partidoNominasModel from './models/partido_nominas.js';
import eventosPartidoModel from './models/eventos_partido.js';
import marcadoresDetalleModel from './models/marcadores_detalle.js';
import valoresPuntosAccionModel from './models/valoresPuntosAccion.js';

import teamModel from './models/Team.js';
import dataTeamModel from './models/DataTeam.js';
import teamMiembrosModel from './models/Team_Miembros.js';

import usuarioComplejoModel from './models/usuario_complejo.js';

import torneoModel from './models/torneo.js';
import faseTorneoModel from './models/faseTorneo.js';
import grupoDivisionModel from './models/grupoDivision.js';
import progresionFixtureModel from './models/progresionFixture.js';
import torneoInscripcionModel from './models/torneoInscripcion.js';
import torneoPlantillaModel from './models/torneoPlantilla.js';
import torneoArbitrosModel from './models/torneoArbitros.js';
import grupoEquiposModel from './models/grupoEquipos.js';
import publicacionesModel from './models/publicaciones.js';
import publicacionDeportesModel from './models/publicacion_deportes.js';
import publicacionEtiquetasModel from './models/publicacion_etiquetas.js';
import seguidoresModel from './models/seguidores.js';
import notificacionModel from './models/notificacion.js';
import dispositivoPushModel from './models/dispositivoPush.js';
import clubModel from './models/club.js';
import clubDivisionModel from './models/clubDivision.js';
import clubSolicitudModel from './models/clubSolicitud.js';
import clubMembresiaSolicitudModel from './models/clubMembresiaSolicitud.js';
import clubMiembroModel from './models/clubMiembro.js';
import clubAnuncioModel from './models/clubAnuncio.js';
import clubDestacadoModel from './models/clubDestacado.js';
import clubDestacadoItemModel from './models/clubDestacadoItem.js';
import clubEventoModel from './models/clubEvento.js';
import clubEventoConfirmacionModel from './models/clubEventoConfirmacion.js';
import clubEventoAsistenciaModel from './models/clubEventoAsistencia.js';
import clubMetricaEvaluacionModel from './models/clubMetricaEvaluacion.js';
import clubEventoEvaluacionModel from './models/clubEventoEvaluacion.js';
import clubDivisionAtletaModel from './models/clubDivisionAtleta.js';
import clubDivisionInvitacionModel from './models/clubDivisionInvitacion.js';
import clubEventoEvaluacionDetalleModel from './models/clubEventoEvaluacionDetalle.js';
import contenidoReaccionModel from './models/contenidoReaccion.js';
import contenidoComentarioModel from './models/contenidoComentario.js';
import contenidoReporteModel from './models/contenidoReporte.js';
import encuestaModel from './models/encuesta.js';
import encuestaOpcionModel from './models/encuestaOpcion.js';
import encuestaVotoModel from './models/encuestaVoto.js';

// Inicializar modelos
const Usuarios = usuariosModel(sequelize);
const Complejos = complejosModel(sequelize);
const Canchas = canchasModel(sequelize);
const DetailsCanchas = detailsCanchasModel(sequelize);
const WallpaperCanchas = wallpaperCanchasModel(sequelize);

const ComplejoHorarios = complejoHorariosModel(sequelize);
const CanchaHorariosPrecios = canchaHorariosPreciosModel(sequelize);
const CalendarioExcepciones = calendarioExcepcionesModel(sequelize);
const ConfiguracionHorariosFavoritos = configuracionHorariosFavoritosModel(sequelize);

const User = userModel(sequelize);
const Sports = sportsModel(sequelize);
const Reservas = reservasModel(sequelize);
const UsuarioStatsPorSport = usuarioStatsPorSportModel(sequelize);

const Partidos = partidosModel(sequelize);
const PartidoConfirmaciones = partidoConfirmacionesModel(sequelize);
const PartidoParticipantes = partidoParticipantesModel(sequelize);
const PartidoJugadorStats = partidoJugadorStatsModel(sequelize);
const PartidoNominas = partidoNominasModel(sequelize);
const EventosPartido = eventosPartidoModel(sequelize);
const MarcadoresDetalle = marcadoresDetalleModel(sequelize);
const ValoresPuntosAccion = valoresPuntosAccionModel(sequelize);

const Team = teamModel(sequelize);
const DataTeam = dataTeamModel(sequelize);
const TeamMiembros = teamMiembrosModel(sequelize);

const UsuarioComplejo = usuarioComplejoModel(sequelize);

const Torneos = torneoModel(sequelize);
const FaseTorneo = faseTorneoModel(sequelize);
const GrupoDivision = grupoDivisionModel(sequelize);
const ProgresionFixture = progresionFixtureModel(sequelize);
const TorneoInscripcion = torneoInscripcionModel(sequelize);
const TorneoPlantilla = torneoPlantillaModel(sequelize);
const TorneoArbitros = torneoArbitrosModel(sequelize);
const GrupoEquipos = grupoEquiposModel(sequelize);

const Publicaciones = publicacionesModel(sequelize);
const PublicacionDeportes = publicacionDeportesModel(sequelize);
const PublicacionEtiquetas = publicacionEtiquetasModel(sequelize);
const Seguidores = seguidoresModel(sequelize);
const Notificaciones = notificacionModel(sequelize);
const DispositivosPush = dispositivoPushModel(sequelize);
const Clubs = clubModel(sequelize);
const ClubDivisiones = clubDivisionModel(sequelize);
const ClubSolicitudes = clubSolicitudModel(sequelize);
const ClubMembresiaSolicitudes = clubMembresiaSolicitudModel(sequelize);
const ClubMiembros = clubMiembroModel(sequelize);
const ClubAnuncios = clubAnuncioModel(sequelize);
const ClubDestacados = clubDestacadoModel(sequelize);
const ClubDestacadoItems = clubDestacadoItemModel(sequelize);
const ClubEventos = clubEventoModel(sequelize);
const ClubEventoConfirmaciones = clubEventoConfirmacionModel(sequelize);
const ClubEventoAsistencias = clubEventoAsistenciaModel(sequelize);
const ClubMetricaEvaluacion = clubMetricaEvaluacionModel(sequelize);
const ClubEventoEvaluacion = clubEventoEvaluacionModel(sequelize);
const ClubDivisionAtletas = clubDivisionAtletaModel(sequelize);
const ClubDivisionInvitaciones = clubDivisionInvitacionModel(sequelize);
const ClubEventoEvaluacionDetalle = clubEventoEvaluacionDetalleModel(sequelize);
const ContenidoReacciones = contenidoReaccionModel(sequelize);
const ContenidoComentarios = contenidoComentarioModel(sequelize);
const ContenidoReportes = contenidoReporteModel(sequelize);
const Encuestas = encuestaModel(sequelize);
const EncuestaOpciones = encuestaOpcionModel(sequelize);
const EncuestaVotos = encuestaVotoModel(sequelize);

// ============================================
// DEFINIR TODAS LAS RELACIONES (ASSOCIATIONS)
// ============================================

// --- COMPLEJOS ---
// Ref: complejos.dueño_id > user.id (mantener para compatibilidad)
Complejos.belongsTo(User, { foreignKey: 'dueño_id', as: 'dueño' });
User.hasMany(Complejos, { foreignKey: 'dueño_id', as: 'complejos' });

// Relación muchos-a-muchos: usuarios pueden tener acceso a múltiples complejos
User.belongsToMany(Complejos, { 
  through: UsuarioComplejo, 
  foreignKey: 'user_id',
  otherKey: 'complejo_id',
  as: 'complejosConAcceso'
});

Complejos.belongsToMany(User, { 
  through: UsuarioComplejo, 
  foreignKey: 'complejo_id',
  otherKey: 'user_id',
  as: 'usuariosConAcceso'
});

// Relaciones directas para acceder a la tabla intermedia
UsuarioComplejo.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });
User.hasMany(UsuarioComplejo, { foreignKey: 'user_id', as: 'accesosComplejos' });

UsuarioComplejo.belongsTo(Complejos, { foreignKey: 'complejo_id', as: 'complejo' });
Complejos.hasMany(UsuarioComplejo, { foreignKey: 'complejo_id', as: 'accesosUsuarios' });

// --- CANCHAS ---
// Ref: canchas.complejo_id > complejos.id
Canchas.belongsTo(Complejos, { foreignKey: 'complejo_id', as: 'complejo' });
Complejos.hasMany(Canchas, { foreignKey: 'complejo_id', as: 'canchas' });

// Ref: canchas.sport_id > sports.id
Canchas.belongsTo(Sports, { foreignKey: 'sport_id', as: 'sport' });
Sports.hasMany(Canchas, { foreignKey: 'sport_id', as: 'canchas' });

// --- DETAILS CANCHAS ---
// Ref: detailsCanchas.cancha_id > canchas.id
DetailsCanchas.belongsTo(Canchas, { foreignKey: 'cancha_id', as: 'cancha' });
Canchas.hasOne(DetailsCanchas, { foreignKey: 'cancha_id', as: 'detalles' });
 
// --- WALLPAPER CANCHAS ---
// Ref: WallpaperCanchas.cancha_id > canchas.id
WallpaperCanchas.belongsTo(Canchas, { foreignKey: 'cancha_id', as: 'cancha' });
Canchas.hasMany(WallpaperCanchas, { foreignKey: 'cancha_id', as: 'wallpapers' });

// --- HORARIOS DE COMPLEJOS ---
// Ref: complejo_horarios.complejo_id > complejos.id
ComplejoHorarios.belongsTo(Complejos, { foreignKey: 'complejo_id', as: 'complejo' });
Complejos.hasMany(ComplejoHorarios, { foreignKey: 'complejo_id', as: 'horarios' });

// --- HORARIOS Y PRECIOS DE CANCHAS ---
// Ref: cancha_horarios_precios.cancha_id > canchas.id
CanchaHorariosPrecios.belongsTo(Canchas, { foreignKey: 'cancha_id', as: 'cancha' });
Canchas.hasMany(CanchaHorariosPrecios, { foreignKey: 'cancha_id', as: 'horariosPrecios' });

// --- CALENDARIO EXCEPCIONES ---
// Ref: calendario_excepciones.complejo_id > complejos.id
CalendarioExcepciones.belongsTo(Complejos, { foreignKey: 'complejo_id', as: 'complejo' });
Complejos.hasMany(CalendarioExcepciones, { foreignKey: 'complejo_id', as: 'excepciones' });

// --- CONFIGURACIÓN HORARIOS FAVORITOS ---
// Ref: configuracion_horarios_favoritos.complejo_id > complejos.id
ConfiguracionHorariosFavoritos.belongsTo(Complejos, { foreignKey: 'complejo_id', as: 'complejo' });
Complejos.hasMany(ConfiguracionHorariosFavoritos, { foreignKey: 'complejo_id', as: 'configuracionesFavoritas' });
// Ref: configuracion_horarios_favoritos.cancha_id > canchas.id
ConfiguracionHorariosFavoritos.belongsTo(Canchas, { foreignKey: 'cancha_id', as: 'cancha' });
Canchas.hasOne(ConfiguracionHorariosFavoritos, { foreignKey: 'cancha_id', as: 'configuracionFavorita' });

// --- RESERVAS ---
// Ref: reservas.user_id > user.id
Reservas.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });
User.hasMany(Reservas, { foreignKey: 'user_id', as: 'reservas' });

// Ref: reservas.cancha_id > canchas.id
Reservas.belongsTo(Canchas, { foreignKey: 'cancha_id', as: 'cancha' });
Canchas.hasMany(Reservas, { foreignKey: 'cancha_id', as: 'reservas' });

// --- USUARIO STATS POR SPORT ---
// Ref: usuario_stats_por_sport.user_id > user.id
UsuarioStatsPorSport.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });
User.hasMany(UsuarioStatsPorSport, { foreignKey: 'user_id', as: 'stats' });

// Ref: usuario_stats_por_sport.sport_id > sports.id
UsuarioStatsPorSport.belongsTo(Sports, { foreignKey: 'sport_id', as: 'sport' });
Sports.hasMany(UsuarioStatsPorSport, { foreignKey: 'sport_id', as: 'usuarioStats' });

// --- VALORES PUNTOS ACCIÓN ---
ValoresPuntosAccion.belongsTo(Sports, { foreignKey: 'sport_id', as: 'sport' });
Sports.hasMany(ValoresPuntosAccion, { foreignKey: 'sport_id', as: 'valoresPuntosAccion' });

// --- PARTIDOS ---
// Ref: partidos.reserva_id > reservas.id
Partidos.belongsTo(Reservas, { foreignKey: 'reserva_id', as: 'reserva' });
Reservas.hasOne(Partidos, { foreignKey: 'reserva_id', as: 'partido' });

// Ref: partidos.started_by_id > user.id
Partidos.belongsTo(User, { foreignKey: 'started_by_id', as: 'iniciador' });
User.hasMany(Partidos, { foreignKey: 'started_by_id', as: 'partidosIniciados' });

// Ref: partidos.arbitro_asignado_id > user.id
Partidos.belongsTo(User, { foreignKey: 'arbitro_asignado_id', as: 'arbitro' });
User.hasMany(Partidos, { foreignKey: 'arbitro_asignado_id', as: 'partidosArbitrados' });

// Ref: partidos.sport_id > sports.id
Partidos.belongsTo(Sports, { foreignKey: 'sport_id', as: 'sport' });
Sports.hasMany(Partidos, { foreignKey: 'sport_id', as: 'partidos' });

// Ref: partidos.cancha_id > canchas.id
Partidos.belongsTo(Canchas, { foreignKey: 'cancha_id', as: 'cancha' });
Canchas.hasMany(Partidos, { foreignKey: 'cancha_id', as: 'partidos' });

// Ref: partidos.torneo_id > torneos.id
Partidos.belongsTo(Torneos, { foreignKey: 'torneo_id', as: 'torneo' });
Torneos.hasMany(Partidos, { foreignKey: 'torneo_id', as: 'partidos' });

// Ref: partidos.fase_torneo_id > fases_torneo.id
Partidos.belongsTo(FaseTorneo, { foreignKey: 'fase_torneo_id', as: 'faseTorneo' });
FaseTorneo.hasMany(Partidos, { foreignKey: 'fase_torneo_id', as: 'partidos' });

// Ref: partidos.grupo_division_id > grupos_divisiones.id
Partidos.belongsTo(GrupoDivision, { foreignKey: 'grupo_division_id', as: 'grupoDivision' });
GrupoDivision.hasMany(Partidos, { foreignKey: 'grupo_division_id', as: 'partidos' });

// --- PARTIDO CONFIRMACIONES ---
// Ref: partido_confirmaciones.partido_id > partidos.id
PartidoConfirmaciones.belongsTo(Partidos, { foreignKey: 'partido_id', as: 'partido' });
Partidos.hasMany(PartidoConfirmaciones, { foreignKey: 'partido_id', as: 'confirmaciones' });

// Ref: partido_confirmaciones.user_id > user.id
PartidoConfirmaciones.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });
User.hasMany(PartidoConfirmaciones, { foreignKey: 'user_id', as: 'confirmaciones' });

// Ref: partido_confirmaciones.team_id > Team.id
PartidoConfirmaciones.belongsTo(Team, { foreignKey: 'team_id', as: 'equipo' });
Team.hasMany(PartidoConfirmaciones, { foreignKey: 'team_id', as: 'confirmaciones' });

// --- PARTIDO PARTICIPANTES ---
// Ref: Partido_Participantes.partido_id > partidos.id
PartidoParticipantes.belongsTo(Partidos, { foreignKey: 'partido_id', as: 'partido' });
Partidos.hasMany(PartidoParticipantes, { foreignKey: 'partido_id', as: 'participantes' });

// Ref: Partido_Participantes.team_id > Team.id
PartidoParticipantes.belongsTo(Team, { foreignKey: 'team_id', as: 'equipo' });
Team.hasMany(PartidoParticipantes, { foreignKey: 'team_id', as: 'participaciones' });

// --- PARTIDO JUGADOR STATS ---
// Ref: partido_jugador_stats.partido_id > partidos.id
PartidoJugadorStats.belongsTo(Partidos, { foreignKey: 'partido_id', as: 'partido' });
Partidos.hasMany(PartidoJugadorStats, { foreignKey: 'partido_id', as: 'jugadorStats' });

// Ref: partido_jugador_stats.user_id > user.id
PartidoJugadorStats.belongsTo(User, { foreignKey: 'user_id', as: 'jugador' });
User.hasMany(PartidoJugadorStats, { foreignKey: 'user_id', as: 'partidoStats' });

// Ref: partido_jugador_stats.team_id > Team.id
PartidoJugadorStats.belongsTo(Team, { foreignKey: 'team_id', as: 'equipo' });
Team.hasMany(PartidoJugadorStats, { foreignKey: 'team_id', as: 'jugadorStats' });

// --- PARTIDO NOMINAS ---
// Ref: partido_nominas.partido_id > partidos.id
PartidoNominas.belongsTo(Partidos, { foreignKey: 'partido_id', as: 'partido' });
Partidos.hasMany(PartidoNominas, { foreignKey: 'partido_id', as: 'nominas' });

// Ref: partido_nominas.team_id > Team.id
PartidoNominas.belongsTo(Team, { foreignKey: 'team_id', as: 'equipo' });
Team.hasMany(PartidoNominas, { foreignKey: 'team_id', as: 'nominas' });

// Ref: partido_nominas.user_id > user.id
PartidoNominas.belongsTo(User, { foreignKey: 'user_id', as: 'jugador' });
User.hasMany(PartidoNominas, { foreignKey: 'user_id', as: 'nominasJugador' });

// Ref: partido_nominas.propuesto_por_id > user.id
PartidoNominas.belongsTo(User, { foreignKey: 'propuesto_por_id', as: 'propuestoPor' });
User.hasMany(PartidoNominas, { foreignKey: 'propuesto_por_id', as: 'nominasPropuestas' });

// Ref: partido_nominas.validado_por_id > user.id
PartidoNominas.belongsTo(User, { foreignKey: 'validado_por_id', as: 'validadoPor' });
User.hasMany(PartidoNominas, { foreignKey: 'validado_por_id', as: 'nominasValidadas' });

// --- EVENTOS PARTIDO ---
// Ref: eventos_partido.partido_id > partidos.id
EventosPartido.belongsTo(Partidos, { foreignKey: 'partido_id', as: 'partido' });
Partidos.hasMany(EventosPartido, { foreignKey: 'partido_id', as: 'eventos' });

// Ref: eventos_partido.actor_principal_id > user.id
EventosPartido.belongsTo(User, { foreignKey: 'actor_principal_id', as: 'actorPrincipal' });
User.hasMany(EventosPartido, { foreignKey: 'actor_principal_id', as: 'eventosComoActorPrincipal' });

// Ref: eventos_partido.actor_secundario_id > user.id
EventosPartido.belongsTo(User, { foreignKey: 'actor_secundario_id', as: 'actorSecundario' });
User.hasMany(EventosPartido, { foreignKey: 'actor_secundario_id', as: 'eventosComoActorSecundario' });

// --- MARCADORES DETALLE ---
// Ref: marcadores_detalle.partido_id > partidos.id (1:1)
MarcadoresDetalle.belongsTo(Partidos, { foreignKey: 'partido_id', as: 'partido' });
Partidos.hasOne(MarcadoresDetalle, { foreignKey: 'partido_id', as: 'marcadorDetalle' });

// Ref: marcadores_detalle.ultimo_evento_id > eventos_partido.id
MarcadoresDetalle.belongsTo(EventosPartido, { foreignKey: 'ultimo_evento_id', as: 'ultimoEvento' });
EventosPartido.hasMany(MarcadoresDetalle, { foreignKey: 'ultimo_evento_id', as: 'marcadoresActualizados' });

// --- TEAM ---
// Ref: Team.capitan_id > user.id
Team.belongsTo(User, { foreignKey: 'capitan_id', as: 'capitan' });
User.hasMany(Team, { foreignKey: 'capitan_id', as: 'equiposCapitan' });

// Ref: Team.sport_id > sports.id
Team.belongsTo(Sports, { foreignKey: 'sport_id', as: 'sport' });
Sports.hasMany(Team, { foreignKey: 'sport_id', as: 'equipos' });

// --- DATA TEAM ---
// Ref: DataTeam.team_id > Team.id
DataTeam.belongsTo(Team, { foreignKey: 'team_id', as: 'equipo' });
Team.hasOne(DataTeam, { foreignKey: 'team_id', as: 'estadisticas' });

// --- TEAM MIEMBROS ---
// Ref: Team_Miembros.user_id > user.id
TeamMiembros.belongsTo(User, { foreignKey: 'user_id', as: 'usuario' });
User.hasMany(TeamMiembros, { foreignKey: 'user_id', as: 'membresiaEquipos' });

// Ref: Team_Miembros.team_id > Team.id
TeamMiembros.belongsTo(Team, { foreignKey: 'team_id', as: 'equipo' });
Team.hasMany(TeamMiembros, { foreignKey: 'team_id', as: 'miembros' });

// --- TORNEOS ---
// Ref: torneos.complejo_id > complejos.id
Torneos.belongsTo(Complejos, { foreignKey: 'complejo_id', as: 'complejo' });
Complejos.hasMany(Torneos, { foreignKey: 'complejo_id', as: 'torneos' });

// Ref: torneos.sport_id > sports.id
Torneos.belongsTo(Sports, { foreignKey: 'sport_id', as: 'sport' });
Sports.hasMany(Torneos, { foreignKey: 'sport_id', as: 'torneos' });

// Ref: torneos.creado_por_user_id > user.id
Torneos.belongsTo(User, { foreignKey: 'creado_por_user_id', as: 'creador' });
User.hasMany(Torneos, { foreignKey: 'creado_por_user_id', as: 'torneosCreados' });

// --- FASES TORNEO ---
// Ref: fases_torneo.torneo_id > torneos.id
FaseTorneo.belongsTo(Torneos, { foreignKey: 'torneo_id', as: 'torneo' });
Torneos.hasMany(FaseTorneo, { foreignKey: 'torneo_id', as: 'fases' });

// --- GRUPOS DIVISIONES ---
// Ref: grupos_divisiones.fase_torneo_id > fases_torneo.id
GrupoDivision.belongsTo(FaseTorneo, { foreignKey: 'fase_torneo_id', as: 'fase' });
FaseTorneo.hasMany(GrupoDivision, { foreignKey: 'fase_torneo_id', as: 'grupos' });

// --- PROGRESION FIXTURE ---
// Ref: progresion_fixture.torneo_id > torneos.id
ProgresionFixture.belongsTo(Torneos, { foreignKey: 'torneo_id', as: 'torneo' });
Torneos.hasMany(ProgresionFixture, { foreignKey: 'torneo_id', as: 'progresiones' });

// Ref: progresion_fixture.partido_origen_id > partidos.id
ProgresionFixture.belongsTo(Partidos, { foreignKey: 'partido_origen_id', as: 'partidoOrigen' });
Partidos.hasMany(ProgresionFixture, { foreignKey: 'partido_origen_id', as: 'progresionesOrigen' });

// Ref: progresion_fixture.partido_destino_id > partidos.id
ProgresionFixture.belongsTo(Partidos, { foreignKey: 'partido_destino_id', as: 'partidoDestino' });
Partidos.hasMany(ProgresionFixture, { foreignKey: 'partido_destino_id', as: 'progresionesDestino' });

// --- TORNEO INSCRIPCIONES ---
TorneoInscripcion.belongsTo(Torneos, { foreignKey: 'torneo_id', as: 'torneo' });
Torneos.hasMany(TorneoInscripcion, { foreignKey: 'torneo_id', as: 'inscripciones' });

TorneoInscripcion.belongsTo(Team, { foreignKey: 'team_id', as: 'equipo' });
Team.hasMany(TorneoInscripcion, { foreignKey: 'team_id', as: 'inscripcionesTorneo' });

TorneoInscripcion.belongsTo(User, { foreignKey: 'iniciado_por_id', as: 'iniciadoPor' });
User.hasMany(TorneoInscripcion, { foreignKey: 'iniciado_por_id', as: 'inscripcionesIniciadas' });

TorneoInscripcion.belongsTo(User, { foreignKey: 'resuelto_por_id', as: 'resueltoPor' });
User.hasMany(TorneoInscripcion, { foreignKey: 'resuelto_por_id', as: 'inscripcionesResueltas' });

TorneoPlantilla.belongsTo(Torneos, { foreignKey: 'torneo_id', as: 'torneo' });
Torneos.hasMany(TorneoPlantilla, { foreignKey: 'torneo_id', as: 'plantilla' });

TorneoPlantilla.belongsTo(Team, { foreignKey: 'team_id', as: 'equipo' });
Team.hasMany(TorneoPlantilla, { foreignKey: 'team_id', as: 'plantillaTorneo' });

TorneoPlantilla.belongsTo(User, { foreignKey: 'user_id', as: 'jugador' });
User.hasMany(TorneoPlantilla, { foreignKey: 'user_id', as: 'dorsalesTorneo' });

TorneoArbitros.belongsTo(Torneos, { foreignKey: 'torneo_id', as: 'torneo' });
Torneos.hasMany(TorneoArbitros, { foreignKey: 'torneo_id', as: 'arbitrosCorporacion' });

TorneoArbitros.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
User.hasMany(TorneoArbitros, { foreignKey: 'usuario_id', as: 'torneosArbitrados' });

// --- GRUPO EQUIPOS ---
GrupoEquipos.belongsTo(GrupoDivision, { foreignKey: 'grupo_division_id', as: 'grupo' });
GrupoDivision.hasMany(GrupoEquipos, { foreignKey: 'grupo_division_id', as: 'equipos' });

GrupoEquipos.belongsTo(Team, { foreignKey: 'team_id', as: 'equipo' });
Team.hasMany(GrupoEquipos, { foreignKey: 'team_id', as: 'asignacionesGrupo' });

// --- PUBLICACIONES ---
Publicaciones.belongsTo(User, { foreignKey: 'user_id', as: 'autor' });
User.hasMany(Publicaciones, { foreignKey: 'user_id', as: 'publicaciones' });

Publicaciones.belongsTo(Team, { foreignKey: 'equipo_id', as: 'equipo' });
Team.hasMany(Publicaciones, { foreignKey: 'equipo_id', as: 'publicacionesEquipo' });

PublicacionDeportes.belongsTo(Publicaciones, { foreignKey: 'publicacion_id', as: 'publicacion' });
Publicaciones.hasMany(PublicacionDeportes, { foreignKey: 'publicacion_id', as: 'deportes' });

PublicacionDeportes.belongsTo(Sports, { foreignKey: 'sport_id', as: 'sport' });
Sports.hasMany(PublicacionDeportes, { foreignKey: 'sport_id', as: 'publicacionesDeporte' });

PublicacionEtiquetas.belongsTo(Publicaciones, { foreignKey: 'publicacion_id', as: 'publicacion' });
Publicaciones.hasMany(PublicacionEtiquetas, { foreignKey: 'publicacion_id', as: 'etiquetas' });

PublicacionEtiquetas.belongsTo(User, { foreignKey: 'user_id_etiquetado', as: 'usuarioEtiquetado' });
User.hasMany(PublicacionEtiquetas, { foreignKey: 'user_id_etiquetado', as: 'etiquetasRecibidas' });

User.belongsTo(Sports, { foreignKey: 'deporte_principal_id', as: 'deportePrincipal' });

// --- SEGUIDORES ---
Seguidores.belongsTo(User, { foreignKey: 'seguidor_user_id', as: 'seguidor' });
User.hasMany(Seguidores, { foreignKey: 'seguidor_user_id', as: 'seguidos' });

Seguidores.belongsTo(User, { foreignKey: 'seguido_user_id', as: 'usuarioSeguido' });
User.hasMany(Seguidores, { foreignKey: 'seguido_user_id', as: 'seguidores' });

Seguidores.belongsTo(Team, { foreignKey: 'seguido_team_id', as: 'equipoSeguido' });
Team.hasMany(Seguidores, { foreignKey: 'seguido_team_id', as: 'seguidores' });

Notificaciones.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
User.hasMany(Notificaciones, { foreignKey: 'usuario_id', as: 'notificaciones' });

DispositivosPush.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
User.hasMany(DispositivosPush, { foreignKey: 'usuario_id', as: 'dispositivosPush' });

// --- CLUBES ---
Clubs.belongsTo(Sports, { foreignKey: 'sport_id', as: 'sport' });
Sports.hasMany(Clubs, { foreignKey: 'sport_id', as: 'clubes' });

Clubs.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });
User.hasMany(Clubs, { foreignKey: 'admin_id', as: 'clubesAdministrados' });

ClubDivisiones.belongsTo(Clubs, { foreignKey: 'club_id', as: 'club' });
Clubs.hasMany(ClubDivisiones, { foreignKey: 'club_id', as: 'divisiones' });

ClubDivisiones.belongsTo(User, { foreignKey: 'encargado_id', as: 'encargado' });
User.hasMany(ClubDivisiones, { foreignKey: 'encargado_id', as: 'divisionesEncargadas' });

ClubSolicitudes.belongsTo(Clubs, { foreignKey: 'club_id', as: 'club' });
Clubs.hasMany(ClubSolicitudes, { foreignKey: 'club_id', as: 'solicitudes' });

ClubSolicitudes.belongsTo(Team, { foreignKey: 'equipo_id', as: 'equipo' });
Team.hasMany(ClubSolicitudes, { foreignKey: 'equipo_id', as: 'solicitudesClub' });

ClubSolicitudes.belongsTo(ClubDivisiones, { foreignKey: 'club_division_id', as: 'division' });
ClubDivisiones.hasMany(ClubSolicitudes, { foreignKey: 'club_division_id', as: 'solicitudes' });

ClubSolicitudes.belongsTo(User, { foreignKey: 'iniciado_por_id', as: 'iniciadoPor' });
User.hasMany(ClubSolicitudes, { foreignKey: 'iniciado_por_id', as: 'solicitudesClubIniciadas' });

ClubSolicitudes.belongsTo(User, { foreignKey: 'resuelto_por_id', as: 'resueltoPor' });
User.hasMany(ClubSolicitudes, { foreignKey: 'resuelto_por_id', as: 'solicitudesClubResueltas' });

Team.belongsTo(Clubs, { foreignKey: 'club_id', as: 'club' });
Clubs.hasMany(Team, { foreignKey: 'club_id', as: 'equipos' });

Team.belongsTo(ClubDivisiones, { foreignKey: 'club_division_id', as: 'clubDivision' });
ClubDivisiones.hasMany(Team, { foreignKey: 'club_division_id', as: 'equipos' });

Torneos.belongsTo(Clubs, { foreignKey: 'club_organizador_id', as: 'clubOrganizador' });
Clubs.hasMany(Torneos, { foreignKey: 'club_organizador_id', as: 'torneos' });

Partidos.belongsTo(User, { foreignKey: 'programado_por_id', as: 'programadoPor' });
User.hasMany(Partidos, { foreignKey: 'programado_por_id', as: 'partidosProgramados' });

Partidos.belongsTo(ClubDivisiones, { foreignKey: 'club_division_id', as: 'clubDivision' });
ClubDivisiones.hasMany(Partidos, { foreignKey: 'club_division_id', as: 'partidosPractica' });

ClubMiembros.belongsTo(Clubs, { foreignKey: 'club_id', as: 'club' });
Clubs.hasMany(ClubMiembros, { foreignKey: 'club_id', as: 'miembros' });
ClubMiembros.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
User.hasMany(ClubMiembros, { foreignKey: 'usuario_id', as: 'membresiasClub' });

ClubMembresiaSolicitudes.belongsTo(Clubs, { foreignKey: 'club_id', as: 'club' });
Clubs.hasMany(ClubMembresiaSolicitudes, { foreignKey: 'club_id', as: 'membresiaSolicitudes' });
ClubMembresiaSolicitudes.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
User.hasMany(ClubMembresiaSolicitudes, { foreignKey: 'usuario_id', as: 'solicitudesMembresiaClub' });
ClubMembresiaSolicitudes.belongsTo(User, { foreignKey: 'resuelto_por_id', as: 'resueltoPor' });
User.hasMany(ClubMembresiaSolicitudes, { foreignKey: 'resuelto_por_id', as: 'membresiaSolicitudesResueltas' });

ClubAnuncios.belongsTo(Clubs, { foreignKey: 'club_id', as: 'club' });
Clubs.hasMany(ClubAnuncios, { foreignKey: 'club_id', as: 'anuncios' });
ClubAnuncios.belongsTo(ClubDivisiones, { foreignKey: 'club_division_id', as: 'division' });
ClubAnuncios.belongsTo(Team, { foreignKey: 'equipo_id', as: 'equipo' });
ClubAnuncios.belongsTo(User, { foreignKey: 'autor_id', as: 'autor' });

ClubDestacados.belongsTo(Clubs, { foreignKey: 'club_id', as: 'club' });
Clubs.hasMany(ClubDestacados, { foreignKey: 'club_id', as: 'destacados' });
ClubDestacadoItems.belongsTo(ClubDestacados, { foreignKey: 'destacado_id', as: 'destacado' });
ClubDestacados.hasMany(ClubDestacadoItems, { foreignKey: 'destacado_id', as: 'items' });

ClubEventos.belongsTo(ClubDivisiones, { foreignKey: 'club_division_id', as: 'division' });
ClubDivisiones.hasMany(ClubEventos, { foreignKey: 'club_division_id', as: 'eventos' });
ClubEventos.belongsTo(User, { foreignKey: 'creado_por_id', as: 'creadoPor' });
ClubEventos.belongsTo(Partidos, { foreignKey: 'partido_id', as: 'partido' });
Partidos.hasMany(ClubEventos, { foreignKey: 'partido_id', as: 'eventosClub' });

ClubEventoConfirmaciones.belongsTo(ClubEventos, { foreignKey: 'evento_id', as: 'evento' });
ClubEventos.hasMany(ClubEventoConfirmaciones, { foreignKey: 'evento_id', as: 'confirmaciones' });
ClubEventoConfirmaciones.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });

ClubEventoAsistencias.belongsTo(ClubEventos, { foreignKey: 'evento_id', as: 'evento' });
ClubEventos.hasMany(ClubEventoAsistencias, { foreignKey: 'evento_id', as: 'asistencias' });
ClubEventoAsistencias.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
ClubEventoAsistencias.belongsTo(User, { foreignKey: 'registrado_por', as: 'registradoPor' });

ClubMetricaEvaluacion.belongsTo(Sports, { foreignKey: 'sport_id', as: 'sport' });
Sports.hasMany(ClubMetricaEvaluacion, { foreignKey: 'sport_id', as: 'metricasClub' });

ClubEventoEvaluacion.belongsTo(ClubEventos, { foreignKey: 'evento_id', as: 'evento' });
ClubEventos.hasMany(ClubEventoEvaluacion, { foreignKey: 'evento_id', as: 'evaluaciones' });
ClubEventoEvaluacion.belongsTo(User, { foreignKey: 'usuario_id', as: 'jugador' });
ClubEventoEvaluacion.belongsTo(User, { foreignKey: 'evaluador_id', as: 'evaluador' });

ClubEventoEvaluacionDetalle.belongsTo(ClubEventoEvaluacion, { foreignKey: 'evaluacion_id', as: 'evaluacion' });
ClubEventoEvaluacion.hasMany(ClubEventoEvaluacionDetalle, { foreignKey: 'evaluacion_id', as: 'detalles' });
ClubEventoEvaluacionDetalle.belongsTo(ClubMetricaEvaluacion, { foreignKey: 'metrica_id', as: 'metrica' });

ClubDivisionAtletas.belongsTo(ClubDivisiones, { foreignKey: 'club_division_id', as: 'division' });
ClubDivisiones.hasMany(ClubDivisionAtletas, { foreignKey: 'club_division_id', as: 'atletas' });
ClubDivisionAtletas.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
User.hasMany(ClubDivisionAtletas, { foreignKey: 'usuario_id', as: 'nominaDivisiones' });

ClubDivisionInvitaciones.belongsTo(ClubDivisiones, { foreignKey: 'club_division_id', as: 'division' });
ClubDivisiones.hasMany(ClubDivisionInvitaciones, { foreignKey: 'club_division_id', as: 'invitaciones' });
ClubDivisionInvitaciones.belongsTo(User, { foreignKey: 'usuario_invitado_id', as: 'invitado' });
ClubDivisionInvitaciones.belongsTo(User, { foreignKey: 'invitado_por_id', as: 'invitador' });
User.hasMany(ClubDivisionInvitaciones, { foreignKey: 'usuario_invitado_id', as: 'invitacionesDivisionRecibidas' });
User.hasMany(ClubDivisionInvitaciones, { foreignKey: 'invitado_por_id', as: 'invitacionesDivisionEnviadas' });

// --- INTERACCIONES SOCIALES ---
ContenidoReacciones.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
User.hasMany(ContenidoReacciones, { foreignKey: 'usuario_id', as: 'reaccionesContenido' });

ContenidoComentarios.belongsTo(User, { foreignKey: 'usuario_id', as: 'autor' });
User.hasMany(ContenidoComentarios, { foreignKey: 'usuario_id', as: 'comentariosContenido' });
ContenidoComentarios.belongsTo(ContenidoComentarios, {
  foreignKey: 'comentario_padre_id',
  as: 'padre',
});
ContenidoComentarios.hasMany(ContenidoComentarios, {
  foreignKey: 'comentario_padre_id',
  as: 'respuestas',
});

ContenidoReportes.belongsTo(User, { foreignKey: 'reportado_por_id', as: 'reportador' });
User.hasMany(ContenidoReportes, { foreignKey: 'reportado_por_id', as: 'reportesContenido' });

Encuestas.hasMany(EncuestaOpciones, { foreignKey: 'encuesta_id', as: 'opciones' });
EncuestaOpciones.belongsTo(Encuestas, { foreignKey: 'encuesta_id', as: 'encuesta' });

EncuestaVotos.belongsTo(Encuestas, { foreignKey: 'encuesta_id', as: 'encuesta' });
Encuestas.hasMany(EncuestaVotos, { foreignKey: 'encuesta_id', as: 'votos' });
EncuestaVotos.belongsTo(EncuestaOpciones, { foreignKey: 'encuesta_opcion_id', as: 'opcion' });
EncuestaOpciones.hasMany(EncuestaVotos, { foreignKey: 'encuesta_opcion_id', as: 'votos' });
EncuestaVotos.belongsTo(User, { foreignKey: 'usuario_id', as: 'usuario' });
User.hasMany(EncuestaVotos, { foreignKey: 'usuario_id', as: 'votosEncuesta' });

// ============================================
// EXPORTAR SEQUELIZE Y TODOS LOS MODELOS
// ============================================

export {
  sequelize,
  Sequelize,
  
  // Modelos básicos
  Usuarios,
  Complejos,
  Canchas,
  DetailsCanchas,
  WallpaperCanchas,
  
  // Horarios y precios
  ComplejoHorarios,
  CanchaHorariosPrecios,
  CalendarioExcepciones,
  ConfiguracionHorariosFavoritos,
  
  // Usuario y deportes
  User,
  Sports,
  Reservas,
  UsuarioStatsPorSport,
  
  // Partidos
  Partidos,
  PartidoConfirmaciones,
  PartidoParticipantes,
  PartidoJugadorStats,
  PartidoNominas,
  EventosPartido,
  MarcadoresDetalle,
  ValoresPuntosAccion,
  
  // Equipos
  Team,
  DataTeam,
  TeamMiembros,
  
  // Relación Usuario-Complejo
  UsuarioComplejo,

  // Torneos
  Torneos,
  FaseTorneo,
  GrupoDivision,
  ProgresionFixture,
  TorneoInscripcion,
  TorneoPlantilla,
  TorneoArbitros,
  GrupoEquipos,

  // Publicaciones y seguidores
  Publicaciones,
  PublicacionDeportes,
  PublicacionEtiquetas,
  Seguidores,
  Notificaciones,
  DispositivosPush,

  // Clubes
  Clubs,
  ClubDivisiones,
  ClubSolicitudes,
  ClubMembresiaSolicitudes,
  ClubMiembros,
  ClubAnuncios,
  ClubDestacados,
  ClubDestacadoItems,
  ClubEventos,
  ClubEventoConfirmaciones,
  ClubEventoAsistencias,
  ClubDivisionAtletas,
  ClubDivisionInvitaciones,
  ClubMetricaEvaluacion,
  ClubEventoEvaluacion,
  ClubEventoEvaluacionDetalle,

  // Interacciones sociales
  ContenidoReacciones,
  ContenidoComentarios,
  ContenidoReportes,
  Encuestas,
  EncuestaOpciones,
  EncuestaVotos,
};

