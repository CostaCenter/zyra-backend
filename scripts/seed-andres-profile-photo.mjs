/**
 * Asigna foto de perfil de prueba a @Andres (Andrés Orrego).
 * Prefiere Cloudinary (sync-profile-photos-cloudinary.mjs) sobre URLs externas.
 *
 * Uso: node scripts/seed-andres-profile-photo.mjs
 */
import sequelize from '../src/config/database.js';
import cloudinary, { isCloudinaryConfigured } from '../src/config/cloudinary.js';

const FALLBACK_REMOTE =
  'https://upload.wikimedia.org/wikipedia/commons/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg';

const FOLDER = `${process.env.CLOUDINARY_FOLDER || 'ZyraEnterprise'}/usuarios`;

try {
  const [users] = await sequelize.query(`
    SELECT id, name, nick, photo
    FROM "user"
    WHERE LOWER(nick) IN ('andres', '@andres')
       OR LOWER(name) LIKE '%andres%orrego%'
       OR LOWER(name) LIKE '%andrés%orrego%'
    ORDER BY id
    LIMIT 5
  `);

  if (!users.length) {
    console.error('No se encontró usuario @Andres / Andrés Orrego.');
    process.exit(1);
  }

  const target = users[0];
  let photoUrl = target.photo;

  const alreadyCloudinary =
    typeof photoUrl === 'string'
    && photoUrl.includes('res.cloudinary.com')
    && photoUrl.includes('/upload/');

  if (!alreadyCloudinary) {
    if (!isCloudinaryConfigured()) {
      console.error('Cloudinary no configurado. Ejecuta sync-profile-photos-cloudinary.mjs con .env.');
      process.exit(1);
    }

    const result = await cloudinary.uploader.upload(FALLBACK_REMOTE, {
      folder: FOLDER,
      resource_type: 'image',
      overwrite: true,
      unique_filename: true,
    });
    photoUrl = result.secure_url;
  }

  await sequelize.query(
    `UPDATE "user" SET photo = :photo WHERE id = :id`,
    { replacements: { photo: photoUrl, id: target.id } },
  );

  console.log('✅ Perfil actualizado:');
  console.log(`   id: ${target.id}`);
  console.log(`   name: ${target.name ?? '—'}`);
  console.log(`   nick: ${target.nick ?? '—'}`);
  console.log(`   photo: ${photoUrl}`);
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
