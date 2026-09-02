/**
 * Categorías de notificaciones para filtros en la app.
 * Para agregar "Reservas": añadir la entrada en CATEGORIAS y mapear los nuevos tipos en TIPO_A_CATEGORIA.
 */
export const CATEGORIAS_NOTIFICACION = {
  EQUIPOS: { key: 'EQUIPOS', label: 'Equipos' },
  TORNEOS: { key: 'TORNEOS', label: 'Torneos' },
  SOCIAL: { key: 'SOCIAL', label: 'Social' },
  // RESERVAS: { key: 'RESERVAS', label: 'Reservas' },
};

export const TIPO_A_CATEGORIA = {
  INVITACION_EQUIPO: 'EQUIPOS',
  RESPUESTA_INVITACION_EQUIPO: 'EQUIPOS',
  SOLICITUD_INSCRIPCION: 'TORNEOS',
  RESPUESTA_INVITACION_TORNEO: 'TORNEOS',
  ASIGNACION_ARBITRO: 'TORNEOS',
  INVITACION_CUERPO_ARBITRAL: 'TORNEOS',
  RESPUESTA_INVITACION_CUERPO_ARBITRAL: 'TORNEOS',
  RESPUESTA_ASIGNACION_ARBITRO: 'TORNEOS',
  NOMINA_PROPUESTA: 'TORNEOS',
  ALINEACION_PENDIENTE_SET: 'TORNEOS',
  RESULTADO_PARTIDO: 'TORNEOS',
  NUEVO_SEGUIDOR: 'SOCIAL',
  ETIQUETA_PENDIENTE: 'SOCIAL',
  INSCRIPCION_ACEPTADA: 'TORNEOS',
  INSCRIPCION_RECHAZADA: 'TORNEOS',
};

export function categoriaDeTipo(tipo) {
  const categoria = TIPO_A_CATEGORIA[tipo];
  if (!categoria) {
    throw new Error(`Tipo de notificación sin categoría asignada: ${tipo}`);
  }
  return categoria;
}

export function listarCategoriasDisponibles() {
  return Object.values(CATEGORIAS_NOTIFICACION);
}

export function esCategoriaValida(categoria) {
  return Boolean(CATEGORIAS_NOTIFICACION[categoria]);
}
