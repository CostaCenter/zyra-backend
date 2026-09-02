import { Partidos, MarcadoresDetalle } from '../db/db.js';
import { emitMarcadorActualizado } from '../socket/partidoSocket.js';

const PARTIDO_ATTRS = [
  'id',
  'state',
  'score_local_final',
  'score_visitante_final',
  'equipo_local_id',
  'equipo_visitante_id',
];

export const serializarMarcadorEnVivo = (marcador) => {
  if (!marcador) return null;
  const json = typeof marcador.toJSON === 'function' ? marcador.toJSON() : marcador;
  return {
    resultado_principal: json.resultado_principal,
    sets_ganados_local: json.sets_ganados_local,
    sets_ganados_visitante: json.sets_ganados_visitante,
    puntos_favor: json.puntos_favor,
    puntos_contra: json.puntos_contra,
    equipo_que_saca: json.equipo_que_saca,
    posiciones_actuales: json.posiciones_actuales,
    metrica_estructura: json.metrica_estructura,
    actualizado_en: json.actualizado_en,
  };
};

/** Punto recién registrado para animación en vista espectador. */
export const serializarUltimoPunto = (evento) => {
  if (!evento) return null;
  const json = typeof evento.toJSON === 'function' ? evento.toJSON() : evento;
  if (json.tipo_evento !== 'PUNTO') return null;
  return {
    id: json.id,
    tipo_evento: json.tipo_evento,
    detalle_json: json.detalle_json,
  };
};

export async function notificarMarcadorEnVivo(
  partidoId,
  { marcador = null, partido = null, ultimoPunto = null } = {}
) {
  if (!partidoId) return;

  const marcadorRow = marcador
    ?? await MarcadoresDetalle.findOne({ where: { partido_id: partidoId } });

  if (!marcadorRow) return;

  const partidoRow = partido
    ?? await Partidos.findByPk(partidoId, { attributes: PARTIDO_ATTRS });

  emitMarcadorActualizado(partidoId, {
    marcador: serializarMarcadorEnVivo(marcadorRow),
    partido: partidoRow
      ? (typeof partidoRow.toJSON === 'function' ? partidoRow.toJSON() : partidoRow)
      : null,
    ultimo_punto: serializarUltimoPunto(ultimoPunto),
  });
}
