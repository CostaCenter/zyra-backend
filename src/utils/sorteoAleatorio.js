import crypto from 'crypto';

/**
 * Fisher-Yates con generador uniforme inyectable (tests / semilla auditada).
 */
export const fisherYatesShuffle = (array, random = Math.random) => {
  const resultado = [...array];

  for (let i = resultado.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }

  return resultado;
};

/** 32 bytes criptográficos para auditar el sorteo. */
export const generarSemillaSorteo = () => crypto.randomBytes(32);

/**
 * PRG determinista a partir de la semilla (SHA-256 encadenado).
 * Permite reproducir el sorteo si un capitán cuestiona el orden.
 */
export const crearRandomDesdeSemilla = (semilla) => {
  if (!Buffer.isBuffer(semilla)) {
    throw new TypeError('semilla debe ser un Buffer');
  }

  let contador = 0;

  return () => {
    const hash = crypto
      .createHash('sha256')
      .update(semilla)
      .update(Buffer.from(String(contador)))
      .digest();
    contador += 1;
    return hash.readUInt32BE(0) / 0x100000000;
  };
};

/**
 * Mezcla equipos con Fisher-Yates + semilla real.
 * @returns {{ equipos: number[], semilla: Buffer, semilla_hex: string }}
 */
export const mezclarEquiposSorteo = (teamIds, semilla = generarSemillaSorteo()) => {
  const random = crearRandomDesdeSemilla(semilla);
  const equipos = fisherYatesShuffle(teamIds, random);

  return {
    equipos,
    semilla,
    semilla_hex: semilla.toString('hex'),
  };
};

/**
 * Sorteo para eliminación directa: orden de equipos + posiciones en el bracket.
 */
export const sorteoEliminacionDirecta = (teamIds, tamanoBracket, semilla = generarSemillaSorteo()) => {
  const random = crearRandomDesdeSemilla(semilla);
  const equiposMezclados = fisherYatesShuffle(teamIds, random);
  const posiciones = fisherYatesShuffle(
    Array.from({ length: tamanoBracket }, (_, index) => index),
    random
  );
  const slots = Array(tamanoBracket).fill(null);

  equiposMezclados.forEach((teamId, index) => {
    slots[posiciones[index]] = teamId;
  });

  return {
    equiposMezclados,
    posiciones,
    slots,
    semilla,
    semilla_hex: semilla.toString('hex'),
  };
};

export const construirEntradaOrdenSorteo = ({
  faseTorneoId,
  grupoDivisionId,
  tipoFormato,
  teamIdsEntrada,
  teamIdsSorteo,
  semillaHex,
  slots = null,
}) => ({
  fase_torneo_id: faseTorneoId,
  grupo_division_id: grupoDivisionId ?? null,
  tipo_formato: tipoFormato,
  generado_at: new Date().toISOString(),
  semilla_hex: semillaHex,
  team_ids_entrada: [...teamIdsEntrada],
  team_ids_sorteo: [...teamIdsSorteo],
  ...(slots ? { slots: [...slots] } : {}),
});

export const fusionarOrdenSorteo = (ordenActual, entrada) => {
  const prev = ordenActual && typeof ordenActual === 'object' ? ordenActual : { sorteos: [] };
  const sorteos = [...(prev.sorteos ?? [])];
  const indice = sorteos.findIndex(
    (item) =>
      item.fase_torneo_id === entrada.fase_torneo_id
      && (item.grupo_division_id ?? null) === (entrada.grupo_division_id ?? null)
  );

  if (indice >= 0) {
    sorteos[indice] = entrada;
  } else {
    sorteos.push(entrada);
  }

  return { sorteos };
};
