/**
 * Escucha marcador_actualizado vía Socket.io para un partido.
 * Ejecutar en una terminal mientras el árbitro anota en otra:
 *   node scripts/test-socket-marcador.mjs [partidoId]
 */
import { io } from 'socket.io-client';

const partidoId = parseInt(process.argv[2] ?? '125', 10);
const baseUrl = process.env.SOCKET_URL ?? 'http://localhost:3000';

console.log(`=== test-socket-marcador — partido #${partidoId} ===`);
console.log(`Conectando a ${baseUrl}...\n`);

const socket = io(baseUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
});

let eventos = 0;

socket.on('connect', () => {
  console.log(`✓ Conectado (${socket.id})`);
  socket.emit('unirse_partido', { partido_id: partidoId });
  console.log(`✓ Unido a sala partido_${partidoId}`);
  console.log('Esperando marcador_actualizado... (anota un punto como árbitro)\n');
});

socket.on('disconnect', (reason) => {
  console.warn(`⚠ Desconectado: ${reason}`);
});

socket.on('connect_error', (err) => {
  console.error(`✗ connect_error: ${err.message}`);
});

socket.on('marcador_actualizado', (payload) => {
  eventos += 1;
  const m = payload?.marcador;
  console.log(`--- Evento #${eventos} ---`);
  console.log(
    `Set ${(m?.metrica_estructura?.parciales_sets?.length ?? 0) + 1}: ` +
      `${m?.puntos_favor ?? 0}-${m?.puntos_contra ?? 0} | ` +
      `Sets ${m?.sets_ganados_local ?? 0}-${m?.sets_ganados_visitante ?? 0} | ` +
      `Saca: ${m?.equipo_que_saca ?? '?'}`
  );
});

process.on('SIGINT', () => {
  console.log(`\nTotal eventos recibidos: ${eventos}`);
  socket.disconnect();
  process.exit(0);
});
