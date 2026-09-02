/**
 * Elimina TODOS los datos marcados como prueba (es_dato_prueba / prefijo SEED_).
 * Ejecutar antes de cualquier lanzamiento real.
 *
 * Uso: node scripts/limpiar-datos-prueba.mjs
 */
import sequelize from '../src/config/database.js';

const log = (msg) => console.log(msg);

const contar = async (sql, replacements = {}) => {
  const [rows] = await sequelize.query(sql, { replacements });
  return Number(rows[0]?.total ?? 0);
};

try {
  console.log('=== Limpieza datos de prueba Zyra ===\n');

  const prevUsuarios = await contar(`
    SELECT COUNT(*)::int AS total FROM "user"
    WHERE es_dato_prueba = true OR nick LIKE 'SEED_%'
  `);

  if (prevUsuarios === 0) {
    console.log('No hay datos seed para eliminar.');
    process.exit(0);
  }

  let eliminados = {};

  await sequelize.transaction(async (t) => {
    const opts = { transaction: t };

    const [seedUserRows] = await sequelize.query(
      `SELECT id FROM "user" WHERE es_dato_prueba = true OR nick LIKE 'SEED_%'`,
      opts
    );
    const seedUserIds = seedUserRows.map((r) => r.id);

    const [seedTeamRows] = await sequelize.query(
      `SELECT id FROM "Team" WHERE es_dato_prueba = true OR name LIKE 'SEED_%'`,
      opts
    );
    const seedTeamIds = seedTeamRows.map((r) => r.id);

    const [seedPubRows] = await sequelize.query(
      `SELECT id FROM publicaciones WHERE es_dato_prueba = true`,
      opts
    );
    const seedPubIds = seedPubRows.map((r) => r.id);

    const [seedPartidoRows] = await sequelize.query(
      `SELECT id FROM partidos WHERE es_dato_prueba = true OR name LIKE 'SEED_%'`,
      opts
    );
    const seedPartidoIds = seedPartidoRows.map((r) => r.id);

    const [seedTorneoRows] = await sequelize.query(
      `SELECT id FROM torneos WHERE es_dato_prueba = true OR nombre LIKE 'SEED_%'`,
      opts
    );
    const seedTorneoIds = seedTorneoRows.map((r) => r.id);

    const deleteByIds = async (table, column, ids, label) => {
      if (!ids.length) {
        eliminados[label] = 0;
        return;
      }
      const [, meta] = await sequelize.query(
        `DELETE FROM ${table} WHERE ${column} IN (:ids)`,
        { replacements: { ids }, ...opts }
      );
      eliminados[label] = meta?.rowCount ?? ids.length;
    };

    // Etiquetas en publicaciones seed o donde el etiquetado es usuario seed
    if (seedPubIds.length || seedUserIds.length) {
      const conditions = [];
      const replacements = {};
      if (seedPubIds.length) {
        conditions.push('publicacion_id IN (:pubIds)');
        replacements.pubIds = seedPubIds;
      }
      if (seedUserIds.length) {
        conditions.push('user_id_etiquetado IN (:userIds)');
        replacements.userIds = seedUserIds;
      }
      const [, meta] = await sequelize.query(
        `DELETE FROM publicacion_etiquetas WHERE ${conditions.join(' OR ')}`,
        { replacements, ...opts }
      );
      eliminados.publicacion_etiquetas = meta?.rowCount ?? 0;
    } else {
      eliminados.publicacion_etiquetas = 0;
    }

    await deleteByIds('publicacion_deportes', 'publicacion_id', seedPubIds, 'publicacion_deportes');
    await deleteByIds('publicaciones', 'id', seedPubIds, 'publicaciones');

    // Seguidores seed o que involucren usuarios seed
    if (seedUserIds.length) {
      const [, metaSeg] = await sequelize.query(
        `DELETE FROM seguidores
         WHERE es_dato_prueba = true
            OR seguidor_user_id IN (:userIds)
            OR seguido_user_id IN (:userIds)`,
        { replacements: { userIds: seedUserIds }, ...opts }
      );
      eliminados.seguidores = metaSeg?.rowCount ?? 0;
    } else {
      const [, metaSeg] = await sequelize.query(
        `DELETE FROM seguidores WHERE es_dato_prueba = true`,
        opts
      );
      eliminados.seguidores = metaSeg?.rowCount ?? 0;
    }

    // Partidos seed (eventos → marcador → stats → nóminas → participantes → partido)
    if (seedPartidoIds.length) {
      await deleteByIds('eventos_partido', 'partido_id', seedPartidoIds, 'eventos_partido');
      await deleteByIds('marcadores_detalle', 'partido_id', seedPartidoIds, 'marcadores_detalle');
      await deleteByIds('partido_jugador_stats', 'partido_id', seedPartidoIds, 'partido_jugador_stats_partidos');
      await deleteByIds('partido_nominas', 'partido_id', seedPartidoIds, 'partido_nominas');
      await sequelize.query(
        `DELETE FROM "Partido_Participantes" WHERE partido_id IN (:ids)`,
        { replacements: { ids: seedPartidoIds }, ...opts }
      );
      eliminados.partido_participantes = seedPartidoIds.length;
      await deleteByIds('partidos', 'id', seedPartidoIds, 'partidos');
    } else {
      eliminados.eventos_partido = 0;
      eliminados.marcadores_detalle = 0;
      eliminados.partido_jugador_stats_partidos = 0;
      eliminados.partido_nominas = 0;
      eliminados.partido_participantes = 0;
      eliminados.partidos = 0;
    }

    if (seedTorneoIds.length) {
      await deleteByIds('torneos', 'id', seedTorneoIds, 'torneos');
    } else {
      eliminados.torneos = 0;
    }

    // Stats de jugador en partidos (por si quedaron huérfanas)
    if (seedUserIds.length) {
      const [, metaPjs] = await sequelize.query(
        `DELETE FROM partido_jugador_stats WHERE user_id IN (:userIds)`,
        { replacements: { userIds: seedUserIds }, ...opts }
      );
      eliminados.partido_jugador_stats = metaPjs?.rowCount ?? 0;
    }

    if (seedTeamIds.length) {
      await sequelize.query(
        `DELETE FROM "Team_Miembros" WHERE team_id IN (:teamIds)`,
        { replacements: { teamIds: seedTeamIds }, ...opts }
      );
      await sequelize.query(
        `DELETE FROM "DataTeam" WHERE team_id IN (:teamIds)`,
        { replacements: { teamIds: seedTeamIds }, ...opts }
      );
      const [, metaTeam] = await sequelize.query(
        `DELETE FROM "Team" WHERE id IN (:teamIds)`,
        { replacements: { teamIds: seedTeamIds }, ...opts }
      );
      eliminados.equipos = metaTeam?.rowCount ?? 0;
    } else {
      eliminados.equipos = 0;
    }

    // Miembros huérfanos de usuarios seed en equipos reales
    if (seedUserIds.length) {
      const [, metaMiembro] = await sequelize.query(
        `DELETE FROM "Team_Miembros" WHERE user_id IN (:userIds)`,
        { replacements: { userIds: seedUserIds }, ...opts }
      );
      eliminados.team_miembros_extra = metaMiembro?.rowCount ?? 0;
    }

    if (seedUserIds.length) {
      const [, metaStats] = await sequelize.query(
        `DELETE FROM usuario_stats_por_sport WHERE user_id IN (:userIds)`,
        { replacements: { userIds: seedUserIds }, ...opts }
      );
      eliminados.usuario_stats_por_sport = metaStats?.rowCount ?? 0;
    }

    // Desvincular capitanía antes de borrar usuarios
    if (seedUserIds.length) {
      await sequelize.query(
        `UPDATE "Team" SET capitan_id = NULL WHERE capitan_id IN (:userIds)`,
        { replacements: { userIds: seedUserIds }, ...opts }
      );
    }

    const [, metaUsers] = await sequelize.query(
      `DELETE FROM "user" WHERE es_dato_prueba = true OR nick LIKE 'SEED_%'`,
      opts
    );
    eliminados.usuarios = metaUsers?.rowCount ?? 0;
  });

  const restantes = await contar(`
    SELECT COUNT(*)::int AS total FROM "user"
    WHERE es_dato_prueba = true OR nick LIKE 'SEED_%'
  `);

  console.log('Registros eliminados:');
  console.log(JSON.stringify(eliminados, null, 2));
  console.log(`\nUsuarios seed restantes: ${restantes}`);

  if (restantes === 0) {
    log('\n✅ Limpieza completada. Base lista para datos reales.');
  } else {
    throw new Error(`Quedaron ${restantes} usuarios seed sin eliminar.`);
  }
} catch (error) {
  console.error('\nError en limpieza:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
