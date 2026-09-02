/**
 * Helpers compartidos: nómina + alineación unificada (vóley).
 */

const MIN_TITULARES = 6;

export const construirArrayAlineacionDesdeJugadores = (jugadores) => {
  const titulares = jugadores.filter((j) => j.rol_nomina === 'TITULAR');
  const arr = new Array(6).fill(null);

  for (const jugador of titulares) {
    const zona = parseInt(jugador.zona, 10);
    const userId = parseInt(jugador.user_id, 10);
    if (Number.isNaN(zona) || zona < 1 || zona > 6 || Number.isNaN(userId)) {
      return { error: 'Cada titular debe tener zona (1-6) y user_id válidos' };
    }
    if (arr[zona - 1] != null) {
      return { error: `Zona ${zona} duplicada entre titulares` };
    }
    arr[zona - 1] = userId;
  }

  if (arr.some((v) => v == null)) {
    return { error: 'Los 6 titulares deben ocupar las zonas 1 a 6 sin repetir' };
  }

  return { array: arr };
};

export const construirArrayAlineacionDesdeNominas = (nominasRows) => {
  const titulares = nominasRows.filter(
    (n) => n.rol_nomina === 'TITULAR' && n.zona >= 1 && n.zona <= 6
  );
  const arr = new Array(6).fill(null);

  for (const nomina of titulares) {
    if (arr[nomina.zona - 1] != null) {
      return null;
    }
    arr[nomina.zona - 1] = nomina.user_id;
  }

  return arr.every((v) => v != null) ? arr : null;
};

export const validarPayloadAlineacionUnificada = (jugadores) => {
  if (!Array.isArray(jugadores) || jugadores.length === 0) {
    return { error: 'jugadores debe ser un array no vacío' };
  }

  let titulares = 0;
  const zonasUsadas = new Set();

  for (const jugador of jugadores) {
    if (jugador.rol_nomina === 'TITULAR') {
      titulares += 1;
      const zona = parseInt(jugador.zona, 10);
      if (Number.isNaN(zona) || zona < 1 || zona > 6) {
        return { error: 'Cada titular debe incluir zona entre 1 y 6' };
      }
      if (zonasUsadas.has(zona)) {
        return { error: `Zona ${zona} duplicada entre titulares` };
      }
      zonasUsadas.add(zona);
    } else if (jugador.rol_nomina === 'SUPLENTE') {
      if (jugador.zona != null && jugador.zona !== '') {
        return { error: 'Los suplentes no deben tener zona asignada' };
      }
    }
  }

  if (titulares !== MIN_TITULARES) {
    return { error: `Debes incluir exactamente ${MIN_TITULARES} titulares en cancha` };
  }

  if (zonasUsadas.size !== MIN_TITULARES) {
    return {
      error: `Los ${MIN_TITULARES} titulares deben cubrir las zonas 1 a 6 sin repetir`
    };
  }

  const userIds = new Set();
  const dorsales = new Set();
  for (const jugador of jugadores) {
    const userId = parseInt(jugador.user_id, 10);
    const dorsal = parseInt(jugador.dorsal, 10);
    if (userIds.has(userId)) {
      return { error: 'Un jugador no puede aparecer más de una vez en la propuesta' };
    }
    if (dorsales.has(dorsal)) {
      return { error: 'No puede haber dorsales duplicados en la propuesta' };
    }
    userIds.add(userId);
    dorsales.add(dorsal);
  }

  const { error } = construirArrayAlineacionDesdeJugadores(jugadores);
  if (error) {
    return { error };
  }

  return { ok: true };
};

export { MIN_TITULARES };
