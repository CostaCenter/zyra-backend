/**
 * Sube fotos de perfil externas (Wikimedia, etc.) a Cloudinary y actualiza la BD.
 *
 * Uso: node scripts/sync-profile-photos-cloudinary.mjs
 */
import sequelize from '../src/config/database.js';
import cloudinary, { isCloudinaryConfigured } from '../src/config/cloudinary.js';

const FOLDER = `${process.env.CLOUDINARY_FOLDER || 'ZyraEnterprise'}/usuarios`;

const isCloudinaryStored = (url) =>
  typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/');

const isRemoteHttp = (url) =>
  typeof url === 'string' && /^https?:\/\//i.test(url.trim());

try {
  if (!isCloudinaryConfigured()) {
    console.error('Cloudinary no está configurado en .env');
    process.exit(1);
  }

  const [users] = await sequelize.query(`
    SELECT id, name, nick, photo
    FROM "user"
    WHERE photo IS NOT NULL
      AND photo NOT LIKE '%res.cloudinary.com/%/upload/%'
    ORDER BY id
  `);

  if (!users.length) {
    console.log('No hay fotos externas que migrar.');
    process.exit(0);
  }

  for (const user of users) {
    const photo = user.photo?.trim();
    if (!isRemoteHttp(photo)) {
      console.log(`⏭  id=${user.id} (${user.name}): URL no migrable`);
      continue;
    }

    if (isCloudinaryStored(photo)) {
      console.log(`✓  id=${user.id} (${user.name}): ya en Cloudinary`);
      continue;
    }

    console.log(`↑  id=${user.id} (${user.name}): subiendo...`);

    const result = await cloudinary.uploader.upload(photo, {
      folder: FOLDER,
      resource_type: 'image',
      overwrite: true,
      unique_filename: true,
    });

    await sequelize.query(
      `UPDATE "user" SET photo = :photo WHERE id = :id`,
      { replacements: { photo: result.secure_url, id: user.id } },
    );

    console.log(`✅ id=${user.id} (${user.name})`);
    console.log(`   ${result.secure_url}`);
  }
} catch (error) {
  console.error('Error:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
