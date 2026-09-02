/**
 * Registra una sanción (tarjeta) en un partido EN_CURSO y verifica eventos + reducer.
 *
 * Uso: node scripts/test-eventos-sancion.mjs
 */
import sequelize from '../src/config/database.js';
import {
  Partidos,
  MarcadoresDetalle,
  EventosPartido,
  PartidoNominas,
} from '../src/db/db.js';
import {
  ejecutarRegistrarPunto,
  ejecutarRegistrarSancion,
} from '../src/services/eventosPartidoService.js';
import { reducirSanciones, filtrarEventosValidos, ordenarEventos } from '../src/services/reducerPartido.js';

const PARTIDO_ID = 19;
const ARBITRO_USER_ID = 14;

const log = (titulo, data) => {
  console.log(`\n--- ${titulo} ---`);
  console.log(JSON.stringify(data, null, 2));
};

const resetearPartidoParaPrueba = async (partidoId) => {
  await MarcadoresDetalle.update(
    { ultimo_evento_id: null },
    { where: { partido_id: partidoId } }
  );

  await EventosPartido.destroy({ where: { partido_id: partidoId } });

  const marcador = await MarcadoresDetalle.findOne({ where: { partido_id: partidoId } });

  if (marcador) {
    await marcador.update({
      resultado_principal: 0,
      sets_ganados_local: 0,
      sets_ganados_visitante: 0,
      puntos_favor: 0,
      puntos_contra: 0,
      metrica_estructura: {},
      ultimo_evento_id: null,
      actualizado_en: new Date(),
    });
  }

  await Partidos.update(
    {
      state: 'EN_CURSO',
      score_local_final: 0,
      score_visitante_final: 0,
    },
    { where: { id: partidoId } }
  );
};

const obtenerJugadorNomina = async (partidoId) => {
  const fila = await PartidoNominas.findOne({
    where: { partido_id: partidoId, estado_validacion: 'VALIDADO' },
    order: [['id', 'ASC']],
    attributes: ['user_id', 'team_id', 'dorsal'],
  });

  if (!fila) {
    throw new Error('No hay jugadores con nómina VALIDADA en este partido');
  }

  return fila;
};

try {
  console.log('=== test-eventos-sancion (partido #19) ===\n');

  const partido = await Partidos.findByPk(PARTIDO_ID, {
    attributes: ['id', 'state', 'arbitro_asignado_id'],
  });

  if (!partido) {
    throw new Error(`Partido #${PARTIDO_ID} no encontrado`);
  }

  if (partido.arbitro_asignado_id !== ARBITRO_USER_ID) {
    await partido.update({ arbitro_asignado_id: ARBITRO_USER_ID, state: 'EN_CURSO' });
    console.log(`Árbitro ajustado a user_id=${ARBITRO_USER_ID}`);
  }

  const jugador = await obtenerJugadorNomina(PARTIDO_ID);
  log('Jugador en nómina', jugador.toJSON());

  await resetearPartidoParaPrueba(PARTIDO_ID);
  console.log(`Partido #${PARTIDO_ID} reseteado (0-0, EN_CURSO, sin eventos)`);

  const punto = await ejecutarRegistrarPunto(PARTIDO_ID, ARBITRO_USER_ID, {
    equipo: 'LOCAL',
    origen: 'JUGADOR',
    jugador_id: jugador.user_id,
  });

  if (punto.status !== 200) {
    throw new Error(`No se pudo registrar punto base: ${punto.message}`);
  }

  log('Marcador tras punto', punto.marcador);

  const marcadorAntes = { ...punto.marcador };

  const sancion = await ejecutarRegistrarSancion(PARTIDO_ID, ARBITRO_USER_ID, {
    jugador_id: jugador.user_id,
    tipo: 'AMARILLA',
  });

  if (sancion.status !== 200) {
    throw new Error(`Registro de sanción falló: ${sancion.message}`);
  }

  log('Evento SANCION creado', sancion.evento);
  log('Sanciones (reducer)', sancion.sanciones);
  log('Marcador devuelto (sin cambio de puntos)', sancion.marcador);

  const puntosSinCambio =
    sancion.marcador.puntos_favor === marcadorAntes.puntos_favor &&
    sancion.marcador.puntos_contra === marcadorAntes.puntos_contra;

  if (!puntosSinCambio) {
    throw new Error('La sanción alteró el marcador de puntos (no debería)');
  }

  const eventosDb = await EventosPartido.findAll({
    where: { partido_id: PARTIDO_ID },
    order: [
      ['ocurrido_en_cliente', 'ASC'],
      ['secuencia_local', 'ASC'],
    ],
    attributes: ['id', 'tipo_evento', 'actor_principal_id', 'detalle_json', 'secuencia_local'],
  });

  log('Eventos en BD', eventosDb.map((e) => e.toJSON()));

  const sancionesEventos = eventosDb.filter((e) => e.tipo_evento === 'SANCION');
  if (sancionesEventos.length !== 1) {
    throw new Error(`Se esperaba 1 evento SANCION, hay ${sancionesEventos.length}`);
  }

  const tarjeta = sancionesEventos[0].detalle_json?.tarjeta;
  if (tarjeta !== 'AMARILLA') {
    throw new Error(`tarjeta esperada AMARILLA, recibida ${tarjeta}`);
  }

  const validos = filtrarEventosValidos(ordenarEventos(eventosDb.map((e) => e.toJSON())));
  const sancionesReducer = reducirSanciones(validos);

  if (sancionesReducer.tarjetas.length !== 1) {
    throw new Error('Reducer no acumuló exactamente 1 tarjeta');
  }

  if (sancionesReducer.tarjetas[0].jugador_id !== jugador.user_id) {
    throw new Error('Reducer asignó tarjeta a jugador incorrecto');
  }

  console.log('\n✅ Sanción registrada correctamente y visible en eventos del partido.');
} catch (error) {
  console.error('\nError:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
