/**
 * Crea partidos FINALIZADO coherentes para equipos/usuarios SEED.
 * Sincroniza goles/partidos en usuario_stats_por_sport y partido_jugador_stats
 * con eventos PUNTO/SANCION (lo que consume stats-por-partido en la app).
 *
 * Requisitos: node scripts/seed-datos-prueba.mjs ya ejecutado.
 *
 * Uso:
 *   node scripts/run-migration-017-es-dato-prueba-partidos.mjs   (primera vez)
 *   node scripts/seed-partidos-prueba.mjs
 *
 * Limpieza: node scripts/limpiar-datos-prueba.mjs (incluye partidos seed)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from '../src/config/database.js';
import { Op } from 'sequelize';
import { urlPortadaPorDeporte } from '../src/utils/portadasDeporte.js';
import {
  Partidos,
  Torneos,
  PartidoParticipantes,
  PartidoNominas,
  EventosPartido,
  MarcadoresDetalle,
  PartidoJugadorStats,
  Team,
  TeamMiembros,
  User,
  UsuarioStatsPorSport,
  Sports,
} from '../src/db/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DISPOSITIVO_SEED = '00000000-0000-4000-a000-000000000001';
const REGLAS_DEFAULT = {
  puntos_por_set: 25,
  ventaja_obligatoria: 2,
  sets_para_ganar: 3,
};

const daysAgo = (days) => new Date(Date.now() - days * 86400000);

const aplicarMigracion = async () => {
  const migrationPath = path.join(
    __dirname,
    '../src/db/migrations/017_es_dato_prueba_partidos.sql'
  );
  const sql = fs.readFileSync(migrationPath, 'utf8');
  await sequelize.query(sql);
};

const contarPartidosSeed = async () => {
  const [rows] = await sequelize.query(`
    SELECT COUNT(*)::int AS total
    FROM partidos
    WHERE es_dato_prueba = true OR name LIKE 'SEED_%'
  `);
  return rows[0]?.total ?? 0;
};

const autoFillGoals = (miembros, totalGoles, statsParcial = {}) => {
  const result = {};
  const userIds = miembros.map((m) => m.user_id);

  for (const uid of userIds) {
    const parcial = statsParcial[uid] ?? statsParcial[String(uid)] ?? {};
    result[uid] = {
      goles: parcial.goles ?? 0,
      asistencias: parcial.asistencias ?? 0,
      amarillas: parcial.amarillas ?? 0,
      rojas: parcial.rojas ?? 0,
    };
  }

  let asignados = Object.values(result).reduce((sum, stat) => sum + stat.goles, 0);
  let restante = totalGoles - asignados;

  const candidatos = userIds.filter(
    (uid) => !('goles' in (statsParcial[uid] ?? {}))
  );
  const pool =
    candidatos.length > 0
      ? candidatos
      : userIds.filter((uid) => (statsParcial[uid]?.goles ?? 0) === 0);

  let idx = 0;
  while (restante > 0 && pool.length) {
    const uid = pool[idx % pool.length];
    result[uid].goles += 1;
    restante -= 1;
    idx += 1;
  }

  return result;
};

const crearPartidoFinalizado = async ({
  nombre,
  localTeamId,
  visitanteTeamId,
  scoreLocal,
  scoreVisitante,
  fecha,
  torneoId,
  sportId,
  arbitroId,
  statsLocal = {},
  statsVisitante = {},
  parcialesSets = null,
  esVoley = false,
  transaction,
}) => {
  const tx = { transaction };

  const partido = await Partidos.create(
    {
      name: nombre,
      sport_id: sportId,
      torneo_id: torneoId,
      state: 'FINALIZADO',
      datetime: fecha,
      tipo: 'OFICIAL',
      score_local_final: scoreLocal,
      score_visitante_final: scoreVisitante,
      arbitro_asignado_id: arbitroId,
      es_dato_prueba: true,
    },
    tx
  );

  await PartidoParticipantes.bulkCreate(
    [
      { partido_id: partido.id, team_id: localTeamId, es_local: true },
      { partido_id: partido.id, team_id: visitanteTeamId, es_local: false },
    ],
    tx
  );

  const [capitanLocal, capitanVisit, miembrosLocal, miembrosVisit] = await Promise.all([
    TeamMiembros.findOne({
      where: { team_id: localTeamId, rol: 'CAPITAN', estado_invitacion: 'ACEPTADO' },
      ...tx,
    }),
    TeamMiembros.findOne({
      where: { team_id: visitanteTeamId, rol: 'CAPITAN', estado_invitacion: 'ACEPTADO' },
      ...tx,
    }),
    TeamMiembros.findAll({
      where: { team_id: localTeamId, estado_invitacion: 'ACEPTADO' },
      order: [['id', 'ASC']],
      ...tx,
    }),
    TeamMiembros.findAll({
      where: { team_id: visitanteTeamId, estado_invitacion: 'ACEPTADO' },
      order: [['id', 'ASC']],
      ...tx,
    }),
  ]);

  const crearNominas = async (miembros, teamId, capitanId) => {
    for (let i = 0; i < miembros.length; i += 1) {
      await PartidoNominas.create(
        {
          partido_id: partido.id,
          team_id: teamId,
          user_id: miembros[i].user_id,
          dorsal: miembros[i].dorsal_habitual ?? i + 1,
          rol_nomina: i < 6 ? 'TITULAR' : 'SUPLENTE',
          propuesto_por_id: capitanId,
          validado_por_id: arbitroId,
          estado_validacion: 'VALIDADO',
          validado_at: new Date(),
          creado_at: new Date(),
        },
        tx
      );
    }
  };

  await crearNominas(miembrosLocal, localTeamId, capitanLocal.user_id);
  await crearNominas(miembrosVisit, visitanteTeamId, capitanVisit.user_id);

  const statsLocalFilled = autoFillGoals(miembrosLocal, scoreLocal, statsLocal);
  const statsVisitFilled = autoFillGoals(miembrosVisit, scoreVisitante, statsVisitante);

  let secuencia = 1;
  const registrarEventos = async (statsMap, esLocal, { esVoley: esVoleyPartido = false } = {}) => {
    const equipo = esLocal ? 'LOCAL' : 'VISITANTE';

    for (const [userId, stats] of Object.entries(statsMap)) {
      const uid = Number(userId);

      for (let g = 0; g < (stats.goles ?? 0); g += 1) {
        await EventosPartido.create(
          {
            partido_id: partido.id,
            dispositivo_id: DISPOSITIVO_SEED,
            secuencia_local: secuencia,
            tipo_evento: 'PUNTO',
            actor_principal_id: uid,
            detalle_json: { equipo, origen: 'JUGADOR', jugador_id: uid },
            ocurrido_en_cliente: fecha,
          },
          tx
        );
        secuencia += 1;
      }

      for (let a = 0; a < (stats.amarillas ?? 0); a += 1) {
        const minutosExtra = secuencia * 7;
        const detalleSancion = { tarjeta: 'AMARILLA' };
        if (esVoley) {
          detalleSancion.set_numero = stats.set_sancion ?? 2;
        }
        await EventosPartido.create(
          {
            partido_id: partido.id,
            dispositivo_id: DISPOSITIVO_SEED,
            secuencia_local: secuencia,
            tipo_evento: 'SANCION',
            actor_principal_id: uid,
            detalle_json: detalleSancion,
            ocurrido_en_cliente: new Date(fecha.getTime() + minutosExtra * 60000),
          },
          tx
        );
        secuencia += 1;
      }

      for (let r = 0; r < (stats.rojas ?? 0); r += 1) {
        const minutosExtra = secuencia * 11;
        const detalleSancion = { tarjeta: 'ROJA' };
        if (esVoley) {
          detalleSancion.set_numero = stats.set_sancion ?? 3;
        }
        await EventosPartido.create(
          {
            partido_id: partido.id,
            dispositivo_id: DISPOSITIVO_SEED,
            secuencia_local: secuencia,
            tipo_evento: 'SANCION',
            actor_principal_id: uid,
            detalle_json: detalleSancion,
            ocurrido_en_cliente: new Date(fecha.getTime() + minutosExtra * 60000),
          },
          tx
        );
        secuencia += 1;
      }
    }
  };

  await registrarEventos(statsLocalFilled, true, { esVoley });
  await registrarEventos(statsVisitFilled, false, { esVoley });

  const crearStatsJugadores = async (miembros, teamId, statsMap) => {
    for (let i = 0; i < Math.min(miembros.length, 6); i += 1) {
      const uid = miembros[i].user_id;
      const stats = statsMap[uid] ?? {
        goles: 0,
        asistencias: 0,
        amarillas: 0,
        rojas: 0,
      };

      await PartidoJugadorStats.create(
        {
          partido_id: partido.id,
          user_id: uid,
          team_id: teamId,
          goles: stats.goles ?? 0,
          asistencias: stats.asistencias ?? 0,
          amarillas: stats.amarillas ?? 0,
          rojas: stats.rojas ?? 0,
        },
        tx
      );
    }
  };

  await crearStatsJugadores(miembrosLocal, localTeamId, statsLocalFilled);
  await crearStatsJugadores(miembrosVisit, visitanteTeamId, statsVisitFilled);

  const localGano = scoreLocal > scoreVisitante;
  const visitanteGano = scoreVisitante > scoreLocal;

  await MarcadoresDetalle.create(
    {
      partido_id: partido.id,
      resultado_principal: localGano ? 1 : visitanteGano ? -1 : 0,
      sets_ganados_local: scoreLocal,
      sets_ganados_visitante: scoreVisitante,
      puntos_favor: scoreLocal,
      puntos_contra: scoreVisitante,
      reglas_arbitraje_snapshot: REGLAS_DEFAULT,
      metrica_estructura: parcialesSets?.length
        ? { parciales_sets: parcialesSets }
        : {},
    },
    tx
  );

  return partido;
};

const sincronizarStatsUsuarios = async (sportId, transaction) => {
  await sequelize.query(
    `
    UPDATE usuario_stats_por_sport uss
    SET
      goles_oficiales = COALESCE(sub.goles, 0),
      partidos_oficiales = COALESCE(sub.partidos, 0)
    FROM (
      SELECT
        pjs.user_id,
        COUNT(DISTINCT pjs.partido_id)::int AS partidos,
        COALESCE(SUM(pjs.goles), 0)::int AS goles
      FROM partido_jugador_stats pjs
      INNER JOIN partidos p ON p.id = pjs.partido_id AND p.state = 'FINALIZADO'
      INNER JOIN "Team" t ON t.id = pjs.team_id AND t.sport_id = :sportId
      INNER JOIN "user" u ON u.id = pjs.user_id
      WHERE u.es_dato_prueba = true OR u.nick LIKE 'SEED_%'
      GROUP BY pjs.user_id
    ) sub
    WHERE uss.user_id = sub.user_id AND uss.sport_id = :sportId
    `,
    { replacements: { sportId }, transaction }
  );

  await sequelize.query(
    `
    UPDATE usuario_stats_por_sport uss
    SET goles_oficiales = 0, partidos_oficiales = 0
    WHERE uss.sport_id = :sportId
      AND uss.user_id IN (
        SELECT id FROM "user" WHERE es_dato_prueba = true OR nick LIKE 'SEED_%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM partido_jugador_stats pjs
        INNER JOIN "Team" t ON t.id = pjs.team_id AND t.sport_id = :sportId
        WHERE pjs.user_id = uss.user_id
      )
    `,
    { replacements: { sportId }, transaction }
  );
};

const resolverEquiposPorNombre = async () => {
  const equipos = await Team.findAll({
    where: {
      [Op.or]: [{ es_dato_prueba: true }, { name: { [Op.like]: 'SEED_%' } }],
    },
    attributes: ['id', 'name', 'sport_id', 'capitan_id'],
  });

  const porNombre = {};
  for (const eq of equipos) {
    porNombre[eq.name] = eq;
  }
  return porNombre;
};

const resolverUsuariosPorNick = async () => {
  const usuarios = await User.findAll({
    where: {
      [Op.or]: [{ es_dato_prueba: true }, { nick: { [Op.like]: 'SEED_%' } }],
    },
    attributes: ['id', 'nick', 'deporte_principal_id'],
  });

  const porNick = {};
  for (const u of usuarios) {
    porNick[u.nick] = u;
  }
  return porNick;
};

try {
  console.log('=== Seed partidos de prueba Zyra (SOLO LOCAL) ===\n');

  await aplicarMigracion();

  const seedUsers = await User.count({
    where: {
      [Op.or]: [{ es_dato_prueba: true }, { nick: { [Op.like]: 'SEED_%' } }],
    },
  });

  if (seedUsers === 0) {
    console.error('No hay usuarios SEED. Ejecuta primero: node scripts/seed-datos-prueba.mjs');
    process.exit(1);
  }

  if (await contarPartidosSeed() > 0) {
    if (!process.argv.includes('--force')) {
      console.error(
        'Ya existen partidos seed. Usa --force para recrearlos, o ejecuta limpiar-datos-prueba.mjs'
      );
      process.exit(1);
    }

    const [seedPartidoRows] = await sequelize.query(`
      SELECT id FROM partidos WHERE es_dato_prueba = true OR name LIKE 'SEED_%'
    `);
    const seedPartidoIds = seedPartidoRows.map((r) => r.id);

    if (seedPartidoIds.length) {
      await sequelize.query(
        `DELETE FROM eventos_partido WHERE partido_id IN (:ids)`,
        { replacements: { ids: seedPartidoIds } }
      );
      await sequelize.query(
        `DELETE FROM marcadores_detalle WHERE partido_id IN (:ids)`,
        { replacements: { ids: seedPartidoIds } }
      );
      await sequelize.query(
        `DELETE FROM partido_jugador_stats WHERE partido_id IN (:ids)`,
        { replacements: { ids: seedPartidoIds } }
      );
      await sequelize.query(
        `DELETE FROM partido_nominas WHERE partido_id IN (:ids)`,
        { replacements: { ids: seedPartidoIds } }
      );
      await sequelize.query(
        `DELETE FROM "Partido_Participantes" WHERE partido_id IN (:ids)`,
        { replacements: { ids: seedPartidoIds } }
      );
      await sequelize.query(
        `DELETE FROM partidos WHERE id IN (:ids)`,
        { replacements: { ids: seedPartidoIds } }
      );
    }

    await sequelize.query(
      `DELETE FROM torneos WHERE es_dato_prueba = true OR nombre LIKE 'SEED_%'`
    );
    console.log('Partidos seed anteriores eliminados (--force).\n');
  }

  const deportes = await Sports.findAll({ attributes: ['id', 'name'] });
  const futbol = deportes.find((d) => /f[uú]tbol/i.test(d.name));
  const voley = deportes.find((d) => /v[oó]ley|volleyball/i.test(d.name));

  if (!futbol || !voley) {
    throw new Error('No se encontraron deportes Fútbol y Vóley.');
  }

  const equipos = await resolverEquiposPorNombre();
  const usuarios = await resolverUsuariosPorNick();
  const arbitroId = usuarios.SEED_jugador_01?.id ?? Object.values(usuarios)[0]?.id;

  const team = (nombre) => {
    const eq = equipos[nombre];
    if (!eq) throw new Error(`Equipo seed no encontrado: ${nombre}`);
    return eq.id;
  };

  const user = (nick) => {
    const u = usuarios[nick];
    if (!u) throw new Error(`Usuario seed no encontrado: ${nick}`);
    return u.id;
  };

  let resumen = {};

  await sequelize.transaction(async (transaction) => {
    const torneoFutbol = await Torneos.create(
      {
        nombre: 'SEED_Copa Primavera',
        sport_id: futbol.id,
        creado_por_user_id: arbitroId,
        estado: 'EN_CURSO',
        visibilidad: 'PUBLICO',
        imagen_portada_url: urlPortadaPorDeporte(futbol.name, 'SEED_Copa Primavera'),
        photo: urlPortadaPorDeporte(futbol.name, 'SEED_Copa Primavera'),
        reglas_arbitraje_json: REGLAS_DEFAULT,
        es_dato_prueba: true,
      },
      { transaction }
    );

    const torneoVoley = await Torneos.create(
      {
        nombre: 'SEED_Liga Vóley Indoor',
        sport_id: voley.id,
        creado_por_user_id: arbitroId,
        estado: 'EN_CURSO',
        visibilidad: 'PUBLICO',
        imagen_portada_url: urlPortadaPorDeporte(voley.name, 'SEED_Liga Vóley Indoor'),
        photo: urlPortadaPorDeporte(voley.name, 'SEED_Liga Vóley Indoor'),
        reglas_arbitraje_json: REGLAS_DEFAULT,
        es_dato_prueba: true,
      },
      { transaction }
    );

    const j01 = user('SEED_jugador_01');
    const j02 = user('SEED_jugador_02');
    const j03 = user('SEED_jugador_03');
    const j21 = user('SEED_jugador_21');

    const fixturesFutbol = [
      {
        nombre: 'SEED_Cordillera vs Atlético',
        local: 'SEED_FC Cordillera',
        visitante: 'SEED_Atlético Horizonte',
        scoreLocal: 4,
        scoreVisitante: 0,
        fecha: daysAgo(35),
        torneoId: torneoFutbol.id,
        statsLocal: { [j01]: { goles: 1 } },
      },
      {
        nombre: 'SEED_Cordillera vs Unión',
        local: 'SEED_FC Cordillera',
        visitante: 'SEED_Unión Parque',
        scoreLocal: 1,
        scoreVisitante: 2,
        fecha: daysAgo(28),
        torneoId: torneoFutbol.id,
        statsLocal: { [j01]: { goles: 1, amarillas: 1 } },
      },
      {
        nombre: 'SEED_Cordillera vs Real Brisa',
        local: 'SEED_FC Cordillera',
        visitante: 'SEED_Real Brisa',
        scoreLocal: 3,
        scoreVisitante: 1,
        fecha: daysAgo(21),
        torneoId: torneoFutbol.id,
        statsLocal: { [j01]: { asistencias: 1 }, [j02]: { goles: 2 }, [j03]: { goles: 1 } },
      },
      {
        nombre: 'SEED_Cordillera vs Cumbre',
        local: 'SEED_FC Cordillera',
        visitante: 'SEED_Deportivo Cumbre',
        scoreLocal: 0,
        scoreVisitante: 2,
        fecha: daysAgo(14),
        torneoId: torneoFutbol.id,
        statsLocal: { [j01]: { rojas: 1 } },
      },
      {
        nombre: 'SEED_Atlético vs Unión',
        local: 'SEED_Atlético Horizonte',
        visitante: 'SEED_Unión Parque',
        scoreLocal: 2,
        scoreVisitante: 2,
        fecha: daysAgo(30),
        torneoId: torneoFutbol.id,
      },
      {
        nombre: 'SEED_Real Brisa vs Cumbre',
        local: 'SEED_Real Brisa',
        visitante: 'SEED_Deportivo Cumbre',
        scoreLocal: 1,
        scoreVisitante: 3,
        fecha: daysAgo(18),
        torneoId: torneoFutbol.id,
      },
      {
        nombre: 'SEED_Atlético vs Real Brisa',
        local: 'SEED_Atlético Horizonte',
        visitante: 'SEED_Real Brisa',
        scoreLocal: 3,
        scoreVisitante: 0,
        fecha: daysAgo(10),
        torneoId: torneoFutbol.id,
      },
    ];

    const fixturesVoley = [
      {
        nombre: 'SEED_Andes vs Altura',
        local: 'SEED_Voleibol Andes',
        visitante: 'SEED_Vóley Altura',
        scoreLocal: 3,
        scoreVisitante: 1,
        fecha: daysAgo(25),
        torneoId: torneoVoley.id,
        statsLocal: { [j21]: { goles: 2, asistencias: 1 } },
        parcialesSets: [[25, 20], [22, 25], [25, 18], [25, 21]],
      },
      {
        nombre: 'SEED_Andes vs Smash Norte',
        local: 'SEED_Voleibol Andes',
        visitante: 'SEED_Smash Norte',
        scoreLocal: 2,
        scoreVisitante: 3,
        fecha: daysAgo(12),
        torneoId: torneoVoley.id,
        statsLocal: { [j21]: { goles: 1, amarillas: 1, set_sancion: 3 } },
        parcialesSets: [[25, 23], [21, 25], [25, 27], [20, 25], [12, 15]],
      },
    ];

    const partidosCreados = [];

    for (const fx of fixturesFutbol) {
      const partido = await crearPartidoFinalizado({
        nombre: fx.nombre,
        localTeamId: team(fx.local),
        visitanteTeamId: team(fx.visitante),
        scoreLocal: fx.scoreLocal,
        scoreVisitante: fx.scoreVisitante,
        fecha: fx.fecha,
        torneoId: fx.torneoId,
        sportId: futbol.id,
        arbitroId,
        statsLocal: fx.statsLocal ?? {},
        statsVisitante: fx.statsVisitante ?? {},
        parcialesSets: fx.parcialesSets ?? null,
        transaction,
      });
      partidosCreados.push(partido.id);
    }

    for (const fx of fixturesVoley) {
      const partido = await crearPartidoFinalizado({
        nombre: fx.nombre,
        localTeamId: team(fx.local),
        visitanteTeamId: team(fx.visitante),
        scoreLocal: fx.scoreLocal,
        scoreVisitante: fx.scoreVisitante,
        fecha: fx.fecha,
        torneoId: fx.torneoId,
        sportId: voley.id,
        arbitroId,
        statsLocal: fx.statsLocal ?? {},
        statsVisitante: fx.statsVisitante ?? {},
        parcialesSets: fx.parcialesSets ?? null,
        esVoley: true,
        transaction,
      });
      partidosCreados.push(partido.id);
    }

    await sincronizarStatsUsuarios(futbol.id, transaction);
    await sincronizarStatsUsuarios(voley.id, transaction);

    resumen = {
      torneos: 2,
      partidos: partidosCreados.length,
      jugador_01_esperado: {
        goles: 2,
        asistencias: 1,
        amarillas: 1,
        rojas: 1,
        partidos: 4,
      },
    };
  });

  console.log('\n✅ Partidos seed completados:\n');
  console.log(JSON.stringify(resumen, null, 2));
  console.log('\nPrueba: login SEED_jugador_01 → perfil → Juegos → SEED_FC Cordillera');
  console.log('Totales esperados en detalle: 2 goles, 1 asistencia, 1 amarilla, 1 roja, 4 partidos');
} catch (error) {
  console.error('\nError en seed partidos:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
