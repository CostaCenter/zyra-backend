/**
 * Ejecuta efectos secundarios (notificaciones in-app, push, fan-out) sin bloquear
 * la respuesta HTTP. Los errores se registran y no llegan al cliente.
 */
export function scheduleSideEffect(label, task) {
  Promise.resolve()
    .then(() => (typeof task === 'function' ? task() : task))
    .catch((error) => {
      console.error(`[SideEffect:${label}]`, error);
    });
}
