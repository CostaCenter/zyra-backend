/**
 * Script de prueba: sube una imagen real a Cloudinary y crea una Publicación en BD.
 *
 * Requisitos:
 *   1. Migración 012 aplicada: node scripts/run-migration-012-publicaciones.mjs
 *   2. Variables en .env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   3. Al menos un usuario en la tabla "user"
 *
 * Uso:
 *   node scripts/test-cloudinary-publicacion.mjs
 *   node scripts/test-cloudinary-publicacion.mjs --user-id=1
 *   node scripts/test-cloudinary-publicacion.mjs --image=./mi-foto.jpg
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import sequelize from '../src/config/database.js';
import { User, Publicaciones } from '../src/db/db.js';
import { isCloudinaryConfigured } from '../src/config/cloudinary.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parseArgs = () => {
  const args = { userId: null, imagePath: null };
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--user-id=')) args.userId = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--image=')) args.imagePath = arg.split('=')[1];
  });
  return args;
};

const crearPngPrueba = () => {
  // PNG 1x1 rojo válido (67 bytes)
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(base64, 'base64');
  const tmpPath = path.join(__dirname, '.test-upload.png');
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
};

const main = async () => {
  if (!isCloudinaryConfigured()) {
    console.error('❌ Cloudinary no configurado. Agrega las variables CLOUDINARY_* en .env');
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  const { userId: userIdArg, imagePath: imageArg } = parseArgs();

  const usuario = userIdArg
    ? await User.findByPk(userIdArg)
    : await User.findOne({ order: [['id', 'ASC']] });

  if (!usuario) {
    console.error('❌ No hay usuarios en la BD. Crea uno con /auth/register primero.');
    process.exit(1);
  }

  let imagePath = imageArg;
  let tmpCreated = false;

  if (!imagePath) {
    imagePath = crearPngPrueba();
    tmpCreated = true;
    console.log('ℹ️  Usando PNG de prueba generado:', imagePath);
  } else if (!fs.existsSync(imagePath)) {
    console.error('❌ No se encontró la imagen:', imagePath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(imagePath);
  const mimetype = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  console.log('⬆️  Subiendo a Cloudinary...');
  const upload = await cloudinary.uploader.upload(
    `data:${mimetype};base64,${buffer.toString('base64')}`,
    { folder: process.env.CLOUDINARY_FOLDER || 'ZyraEnterprise', resource_type: 'image' }
  );

  if (!upload.secure_url) {
    console.error('❌ Cloudinary no devolvió secure_url');
    process.exit(1);
  }

  console.log('✅ secure_url:', upload.secure_url);

  const publicacion = await Publicaciones.create({
    user_id: usuario.id,
    tipo: 'FOTO',
    url_media: upload.secure_url,
    caption: 'Prueba piloto Cloudinary — script test-cloudinary-publicacion.mjs'
  });

  const verificacion = await Publicaciones.findByPk(publicacion.id);

  if (verificacion?.url_media === upload.secure_url) {
    console.log('✅ Publicación guardada en BD');
    console.log('   id:', verificacion.id);
    console.log('   user_id:', verificacion.user_id);
    console.log('   url_media:', verificacion.url_media);
  } else {
    console.error('❌ La URL no coincide en la BD');
    process.exit(1);
  }

  if (tmpCreated) {
    fs.unlinkSync(imagePath);
  }
};

main()
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
