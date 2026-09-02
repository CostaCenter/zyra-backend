/**
 * Agrega al organizador (creador) al cuerpo arbitral de torneos existentes.
 *
 * Uso:
 *   node scripts/backfill-torneo-arbitros-organizador.mjs "Zyra Celestial"
 *   node scripts/backfill-torneo-arbitros-organizador.mjs 14
 *   node scripts/backfill-torneo-arbitros-organizador.mjs --all
 */
import sequelize from '../src/config/database.js';
import { Torneos, TorneoArbitros, User } from '../src/db/db.js';

const arg = process.argv[2] ?? 'Zyra Celestial';

const resolverTorneo = async () => {
  const idNum = Number(arg);
  if (!Number.isNaN(idNum) && idNum > 0) {
    return Torneos.findByPk(idNum, {
      attributes: ['id', 'nombre', 'creado_por_user_id'],
    });
  }

  return Torneos.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('nombre')),
      'LIKE',
      `%${arg.toLowerCase()}%`
    ),
    attributes: ['id', 'nombre', 'creado_por_user_id'],
  });
};

const agregarOrganizador = async (torneo) => {
  if (!torneo.creado_por_user_id) {
    console.log(`  ⚠ ${torneo.nombre} (#${torneo.id}): sin creador, se omite.`);
    return { added: 0, skipped: 1 };
  }

  const existente = await TorneoArbitros.findOne({
    where: {
      torneo_id: torneo.id,
      usuario_id: torneo.creado_por_user_id,
    },
  });

  if (existente) {
    const user = await User.findByPk(torneo.creado_por_user_id, {
      attributes: ['nick', 'name'],
    });
    console.log(
      `  · ${torneo.nombre} (#${torneo.id}): ya estaba @${user?.nick ?? torneo.creado_por_user_id}`
    );
    return { added: 0, skipped: 1 };
  }

  await TorneoArbitros.create({
    torneo_id: torneo.id,
    usuario_id: torneo.creado_por_user_id,
  });

  const user = await User.findByPk(torneo.creado_por_user_id, {
    attributes: ['nick', 'name'],
  });
  console.log(
    `  ✓ ${torneo.nombre} (#${torneo.id}): agregado @${user?.nick ?? user?.name ?? torneo.creado_por_user_id}`
  );
  return { added: 1, skipped: 0 };
};

try {
  if (arg === '--all') {
    console.log('=== backfill cuerpo arbitral — todos los torneos ===\n');
    const torneos = await Torneos.findAll({
      attributes: ['id', 'nombre', 'creado_por_user_id'],
      order: [['id', 'ASC']],
    });

    let added = 0;
    let skipped = 0;
    for (const torneo of torneos) {
      const result = await agregarOrganizador(torneo);
      added += result.added;
      skipped += result.skipped;
    }

    console.log(`\n✅ Listo. ${added} agregado(s), ${skipped} omitido(s).`);
  } else {
    const torneo = await resolverTorneo();
    if (!torneo) {
      throw new Error(`No se encontró torneo: ${arg}`);
    }

    console.log(`=== backfill cuerpo arbitral — ${torneo.nombre} (#${torneo.id}) ===\n`);
    const result = await agregarOrganizador(torneo);
    console.log(`\n✅ Listo. ${result.added ? 'Organizador agregado al cuerpo arbitral.' : 'Sin cambios.'}`);
  }
} catch (error) {
  console.error('\nError:', error.message ?? error);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
