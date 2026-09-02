import { Server } from 'socket.io';

let io = null;

export const salaPartido = (partidoId) => `partido_${partidoId}`;

export const salaUsuario = (usuarioId) => `usuario_${usuarioId}`;

export function initPartidoSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('unirse_partido', ({ partido_id: partidoId } = {}) => {
      const id = parseInt(partidoId, 10);
      if (!Number.isFinite(id) || id <= 0) return;
      socket.join(salaPartido(id));
    });

    socket.on('salir_partido', ({ partido_id: partidoId } = {}) => {
      const id = parseInt(partidoId, 10);
      if (!Number.isFinite(id) || id <= 0) return;
      socket.leave(salaPartido(id));
    });

    socket.on('unirse_usuario', ({ usuario_id: usuarioId } = {}) => {
      const id = parseInt(usuarioId, 10);
      if (!Number.isFinite(id) || id <= 0) return;
      socket.join(salaUsuario(id));
    });

    socket.on('salir_usuario', ({ usuario_id: usuarioId } = {}) => {
      const id = parseInt(usuarioId, 10);
      if (!Number.isFinite(id) || id <= 0) return;
      socket.leave(salaUsuario(id));
    });
  });

  return io;
}

export function emitMarcadorActualizado(partidoId, payload) {
  if (!io || !partidoId) return;
  io.to(salaPartido(partidoId)).emit('marcador_actualizado', {
    partido_id: partidoId,
    ...payload,
  });
}

export function emitNuevaNotificacion(usuarioId, payload) {
  if (!io || !usuarioId) return;
  io.to(salaUsuario(usuarioId)).emit('nueva_notificacion', payload);
}
