/**
 * Asigna URLs de imagen de prueba a torneos existentes (columna photo).
 * Solo actualiza torneos sin photo o con --force.
 *
 * Uso: node scripts/seed-torneo-photos.mjs
 *      node scripts/seed-torneo-photos.mjs --force
 */
import sequelize from '../src/config/database.js';

const force = process.argv.includes('--force');

/** Imágenes públicas Unsplash (deportes / torneos) */
const PHOTOS_BY_SPORT = {
  fútbol: 'https://images.unsplash.com/photo-1574629810360-7abbe0c37703?w=400&h=400&fit=crop',
  futbol: 'https://images.unsplash.com/photo-1574629810360-7abbe0c37703?w=400&h=400&fit=crop',
  football: 'https://images.unsplash.com/photo-1574629810360-7abbe0c37703?w=400&h=400&fit=crop',
  voleibol: 'https://images.unsplash.com/photo-1612872085522-316dca827258?w=400&h=400&fit=crop',
  voley: 'https://images.unsplash.com/photo-1612872085522-316dca827258?w=400&h=400&fit=crop',
  volleyball: 'https://images.unsplash.com/photo-1612872085522-316dca827258?w=400&h=400&fit=crop',
  baloncesto: 'https://images.unsplash.com/photo-1546519638-68fa07dac299?w=400&h=400&fit=crop',
  basketball: 'https://images.unsplash.com/photo-1546519638-68fa07dac299?w=400&h=400&fit=crop',
  tenis: 'https://images.unsplash.com/photo-1554068865-5247c2a8f0f8?w=400&h=400&fit=crop',
  tennis: 'https://images.unsplash.com/photo-1554068865-5247c2a8f0f8?w=400&h=400&fit=crop',
  padel: 'https://images.unsplash.com/photo-1554068865-5247c2a8f0f8?w=400&h=400&fit=crop',
  fútbol_playa: 'https://images.unsplash.com/photo-1575361204480-05adf1d0b4a0?w=400&h=400&fit=crop',
  'fútbol playa': 'https://images.unsplash.com/photo-1575361204480-05adf1d0b4a0?w=400&h=400&fit=crop',
};

const DEFAULT_PHOTO =
  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=400&fit=crop';

function photoForSport(sportName) {
  if (!sportName) return DEFAULT_PHOTO;
  const key = sportName.trim().toLowerCase();
  return PHOTOS_BY_SPORT[key] ?? DEFAULT_PHOTO;
}

try {
  const [torneos] = await sequelize.query(`
    SELECT t.id, t.nombre, t.photo, s.name AS sport
    FROM torneos t
    LEFT JOIN sports s ON s.id = t.sport_id
    ORDER BY t.id
  `);

  if (!torneos.length) {
    console.log('No hay torneos en la base de datos.');
    process.exit(0);
  }

  let updated = 0;
  let skipped = 0;

  for (const torneo of torneos) {
    if (torneo.photo && !force) {
      console.log(`⏭️  #${torneo.id} ${torneo.nombre} — ya tiene photo, omitido`);
      skipped++;
      continue;
    }

    const photo = photoForSport(torneo.sport);
    await sequelize.query(
      `UPDATE torneos SET photo = :photo WHERE id = :id`,
      { replacements: { photo, id: torneo.id } }
    );
    console.log(`✅ #${torneo.id} ${torneo.nombre} (${torneo.sport ?? 'sin deporte'}) → ${photo}`);
    updated++;
  }

  console.log(`\nListo: ${updated} actualizados, ${skipped} omitidos.`);
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
