/**
 * Verifica que la elección del árbitro inicializa equipo_que_saca
 * y que la rotación automática respeta ese saque inicial.
 * Ejecutar: node scripts/test-equipo-que-saca-rotacion.mjs
 */
import sequelize from '../src/config/database.js';
import { Partidos, MarcadoresDetalle } from '../src/db/db.js';
import {
  ejecutarInicioPartido,
  ejecutarDefinirEquipoQueSacaInicial,
} from '../src/controllers/partidosController.js';
import { asegurarNominasValidadasPartido } from './test-helpers-nominas.mjs';
import { reducirPosicionesVolley } from '../src/services/reducerPartido.js';

const TORNEO_ID = 2;
const GRUPO_A_ID = 1;
const ARBITRO_USER_ID = 1;

function assert(condicion, mensaje) {
  if (!condicion) {
    throw new Error(mensaje);
  }
}

function crearPunto(id, equipo, secuencia) {
  return {
    id,
    dispositivo_id: 'dev-test-saque-arbitro',
    secuencia_local: secuencia,
    ocurrido_en_cliente: `2026-08-26T10:${String(secuencia).padStart(2, '0')}:00Z`,
    tipo_evento: 'PUNTO',
    detalle_json: { equipo },
  };
}

const resolverPartido = async () => {
  const partido = await Partidos.findOne({
    where: { torneo_id: TORNEO_ID, grupo_division_id: GRUPO_A_ID },
    order: [['id', 'ASC']],
    attributes: ['id'],
  });

  if (!partido) {
    throw new Error('No hay partido de prueba. Ejecuta test-generar-fixture.mjs primero.');
  }

  return partido.id;
};

try {
  console.log('=== test-equipo-que-saca-rotacion ===\n');

  const partidoId = await resolverPartido();
  console.log(`Partido id=${partidoId}`);

  await MarcadoresDetalle.destroy({ where: { partido_id: partidoId } });
  await Partidos.update(
    {
      state: 'PROGRAMADO',
      arbitro_asignado_id: ARBITRO_USER_ID,
      equipo_que_saca_inicial: null,
    },
    { where: { id: partidoId } }
  );

  const bloqueo = await ejecutarInicioPartido(partidoId, ARBITRO_USER_ID);
  assert(
    bloqueo.status === 400,
    'Debe bloquear inicio sin saque inicial definido'
  );
  console.log('✓ Inicio bloqueado sin elección del árbitro');

  const definir = await ejecutarDefinirEquipoQueSacaInicial(
    partidoId,
    ARBITRO_USER_ID,
    'visitante'
  );
  assert(definir.status === 200, `Definir saque falló: ${definir.message}`);

  await asegurarNominasValidadasPartido(partidoId, ARBITRO_USER_ID);
  const inicio = await ejecutarInicioPartido(partidoId, ARBITRO_USER_ID);
  assert(inicio.status === 200, `Inicio falló: ${inicio.message}`);
  assert(
    inicio.marcador?.equipo_que_saca === 'visitante',
    `Marcador debe iniciar con visitante sacando, recibido: ${inicio.marcador?.equipo_que_saca}`
  );
  console.log('✓ Marcador creado con equipo_que_saca = visitante');

  const posiciones = inicio.marcador?.posiciones_actuales ?? {
    equipo_local: [101, 102, 103, 104, 105, 106],
    equipo_visitante: [201, 202, 203, 204, 205, 206],
  };

  const eventos = [
    crearPunto(1, 'VISITANTE', 1),
    crearPunto(2, 'VISITANTE', 2),
    crearPunto(3, 'LOCAL', 3),
  ];

  const estado = reducirPosicionesVolley(eventos, posiciones, 'visitante');

  assert(
    estado.equipo_que_saca === 'local',
    `Tras side-out local, debe sacar local. Recibido: ${estado.equipo_que_saca}`
  );
  console.log('✓ Rotación: side-out desde saque visitante transfiere saque a local');

  console.log('\n=== Todas las pruebas pasaron ===');
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
