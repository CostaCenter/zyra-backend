/**
 * Reinicia marcador de KABO vs Apex (torneo "Prueba con los chicos") sin tocar nóminas.
 * Ejecutar: node scripts/reset-partido-kabo-apex.mjs
 */
import sequelize from '../src/config/database.js';
import {
  Partidos,
  PartidoParticipantes,
  MarcadoresDetalle,
  EventosPartido,
  Team,
} from '../src/db/db.js';

const TORNEO_ID = 19;
const KABO_ID = 12;
const APEX_ID = 40;

const partidosTorneo = await Partidos.findAll({
  where: { torneo_id: TORNEO_ID },
  attributes: ['id', 'state', 'equipo_que_saca_inicial', 'alineacion_local', 'alineacion_visitante'],
  include: [{
    model: PartidoParticipantes,
    as: 'participantes',
    attributes: ['team_id', 'es_local'],
    include: [{ model: Team, as: 'equipo', attributes: ['id', 'name'] }],
  }],
  order: [['id', 'ASC']],
});

const partidoMatch = partidosTorneo.find((p) => {
  const teamIds = (p.participantes ?? []).map((x) => x.team_id);
  return teamIds.includes(KABO_ID) && teamIds.includes(APEX_ID);
});

if (!partidoMatch) {
  throw new Error('No se encontró el partido KABO CLUB vs Apex club en el torneo');
}

const partidoId = partidoMatch.id;
const localName = partidoMatch.participantes.find((x) => x.es_local)?.equipo?.name ?? 'Local';
const visitName = partidoMatch.participantes.find((x) => !x.es_local)?.equipo?.name ?? 'Visitante';

console.log(`=== Reinicio partido #${partidoId}: ${localName} vs ${visitName} ===\n`);
console.log('Estado anterior:', partidoMatch.state);

const partido = await Partidos.findByPk(partidoId);
const posicionesIniciales = {
  equipo_local: partido.alineacion_local ?? null,
  equipo_visitante: partido.alineacion_visitante ?? null,
};
const equipoQueSaca = partido.equipo_que_saca_inicial;

if (!equipoQueSaca) {
  console.warn('⚠ equipo_que_saca_inicial no definido — el árbitro deberá elegirlo de nuevo si vuelve a PROGRAMADO');
}

await MarcadoresDetalle.update(
  { ultimo_evento_id: null },
  { where: { partido_id: partidoId } },
);

const eventosEliminados = await EventosPartido.destroy({ where: { partido_id: partidoId } });
console.log(`Eventos eliminados: ${eventosEliminados}`);

const marcador = await MarcadoresDetalle.findOne({ where: { partido_id: partidoId } });

if (marcador) {
  await marcador.update({
    resultado_principal: 0,
    sets_ganados_local: 0,
    sets_ganados_visitante: 0,
    puntos_favor: 0,
    puntos_contra: 0,
    metrica_estructura: {},
    posiciones_actuales: posicionesIniciales,
    equipo_que_saca: equipoQueSaca,
    ultimo_evento_id: null,
    actualizado_en: new Date(),
  });
} else {
  await MarcadoresDetalle.create({
    partido_id: partidoId,
    reglas_arbitraje_snapshot: { puntos_por_set: 25, ventaja_obligatoria: 2, sets_para_ganar: 3 },
    posiciones_actuales: posicionesIniciales,
    equipo_que_saca: equipoQueSaca,
  });
}

await partido.update({
  state: 'EN_CURSO',
  score_local_final: null,
  score_visitante_final: null,
});

const verificacion = await MarcadoresDetalle.findOne({ where: { partido_id: partidoId } });
const partidoFinal = await Partidos.findByPk(partidoId, { attributes: ['id', 'state'] });

console.log('\nEstado final:');
console.log({
  partido_id: partidoFinal.id,
  state: partidoFinal.state,
  puntos: `${verificacion.puntos_favor}-${verificacion.puntos_contra}`,
  sets: `${verificacion.sets_ganados_local}-${verificacion.sets_ganados_visitante}`,
  equipo_que_saca: verificacion.equipo_que_saca,
  posiciones: verificacion.posiciones_actuales,
});

console.log('\n✅ Partido reiniciado — nóminas intactas, listo para anotar puntos.');

await sequelize.close();
