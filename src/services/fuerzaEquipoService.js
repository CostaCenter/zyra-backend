import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { DataTeam, TeamMiembros } from '../db/db.js';

export const MIN_PARTIDOS_FUERZA_PLENA = 3;

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Promedio de puntos personales por partido en la liga/deporte (todos los jugadores).
 */
export const calcularPromedioLigaPuntosPersonales = async (sportId, transaction = null) => {
  if (!sportId) {
    return 0;
  }

  const [fila] = await sequelize.query(
    `
    SELECT AVG(pjs.puntos_personales)::float AS promedio
    FROM partido_jugador_stats pjs
    INNER JOIN partidos p ON p.id = pjs.partido_id AND p.state = 'FINALIZADO'
    INNER JOIN "Team" t ON t.id = pjs.team_id AND t.sport_id = :sportId
    `,
    {
      replacements: { sportId },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  return toNumber(fila?.promedio, 0);
};

/**
 * Promedio de puntos personales por partido de un jugador en el deporte.
 */
export const calcularPromedioPuntosJugador = async (
  userId,
  sportId,
  transaction = null
) => {
  if (!sportId) {
    return { promedio: 0, partidos: 0 };
  }

  const [fila] = await sequelize.query(
    `
    SELECT
      AVG(pjs.puntos_personales)::float AS promedio,
      COUNT(DISTINCT pjs.partido_id)::int AS partidos
    FROM partido_jugador_stats pjs
    INNER JOIN partidos p ON p.id = pjs.partido_id AND p.state = 'FINALIZADO'
    INNER JOIN "Team" t ON t.id = pjs.team_id AND t.sport_id = :sportId
    WHERE pjs.user_id = :userId
    `,
    {
      replacements: { userId, sportId },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  return {
    promedio: toNumber(fila?.promedio, 0),
    partidos: toNumber(fila?.partidos, 0),
  };
};

/**
 * Ajusta el promedio si el jugador tiene menos de MIN partidos (valor neutral de liga).
 */
export const ajustarPromedioPorExperiencia = (promedioJugador, partidosJugador, promedioLiga) => {
  if (partidosJugador >= MIN_PARTIDOS_FUERZA_PLENA) {
    return promedioJugador;
  }

  if (partidosJugador <= 0) {
    return promedioLiga;
  }

  const pesoPropio = partidosJugador / MIN_PARTIDOS_FUERZA_PLENA;
  return (pesoPropio * promedioJugador) + ((1 - pesoPropio) * promedioLiga);
};

/**
 * Fuerza del equipo = promedio de promedios ajustados del roster aceptado.
 */
export const calcularFuerzaEquipo = async (teamId, sportId, transaction = null) => {
  if (!teamId || !sportId) {
    return null;
  }

  const miembros = await TeamMiembros.findAll({
    where: {
      team_id: teamId,
      estado_invitacion: 'ACEPTADO',
    },
    attributes: ['user_id'],
    transaction,
  });

  if (!miembros.length) {
    return null;
  }

  const promedioLiga = await calcularPromedioLigaPuntosPersonales(sportId, transaction);

  const promediosAjustados = await Promise.all(
    miembros.map(async (miembro) => {
      const { promedio, partidos } = await calcularPromedioPuntosJugador(
        miembro.user_id,
        sportId,
        transaction
      );
      return ajustarPromedioPorExperiencia(promedio, partidos, promedioLiga);
    })
  );

  const suma = promediosAjustados.reduce((acc, val) => acc + val, 0);
  return Number((suma / promediosAjustados.length).toFixed(2));
};

export const actualizarFuerzaEquipoEnDataTeam = async (
  teamId,
  sportId,
  transaction = null
) => {
  const fuerza = await calcularFuerzaEquipo(teamId, sportId, transaction);
  if (fuerza == null) {
    return null;
  }

  const [registro] = await DataTeam.findOrCreate({
    where: { team_id: teamId },
    defaults: { team_id: teamId },
    transaction,
  });

  await registro.update({ fuerza_equipo: fuerza }, { transaction });
  return fuerza;
};
