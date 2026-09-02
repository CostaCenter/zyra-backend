/**
 * Prueba de subida de VIDEO a Cloudinary + guardado en publicaciones.
 *
 * Uso:
 *   node scripts/test-cloudinary-video.mjs
 *   node scripts/test-cloudinary-video.mjs --user-id=1
 *   node scripts/test-cloudinary-video.mjs --file=./mi-video.mp4
 */

import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import sequelize from '../src/config/database.js';
import { User, Publicaciones } from '../src/db/db.js';
import {
  subirMediaPublicacion,
  inferirTipoPublicacion
} from '../src/services/cloudinaryService.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_MP4_URL =
  'https://res.cloudinary.com/demo/video/upload/c_scale,w_200/dog.mp4';

const parseArgs = () => {
  const args = { userId: null, filePath: null };
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--user-id=')) args.userId = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--file=')) args.filePath = arg.split('=')[1];
  });
  return args;
};

const descargar = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Descarga falló HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });

const main = async () => {
  const { userId: userIdArg, filePath } = parseArgs();

  const usuario = userIdArg
    ? await User.findByPk(userIdArg)
    : await User.findOne({ order: [['id', 'ASC']] });

  if (!usuario) {
    console.error('❌ No hay usuarios en la BD.');
    process.exit(1);
  }

  let buffer;
  let originalname = 'test-video.mp4';
  let mimetype = 'video/mp4';

  if (filePath) {
    if (!fs.existsSync(filePath)) {
      console.error('❌ Archivo no encontrado:', filePath);
      process.exit(1);
    }
    buffer = fs.readFileSync(filePath);
    originalname = path.basename(filePath);
    if (originalname.endsWith('.mov')) mimetype = 'video/quicktime';
  } else {
    console.log('⬇️  Descargando video de prueba corto...');
    buffer = await descargar(SAMPLE_MP4_URL);
    console.log(`   ${buffer.length} bytes`);
  }

  const mockFile = {
    buffer,
    mimetype,
    originalname,
    size: buffer.length
  };

  const tipo = inferirTipoPublicacion(mimetype, originalname);
  console.log('📋 Tipo detectado:', tipo);

  console.log('⬆️  Subiendo a Cloudinary (resource_type: video)...');
  const upload = await subirMediaPublicacion(mockFile);
  console.log('✅ secure_url:', upload.secure_url);
  console.log('   resource_type:', upload.resource_type);

  const publicacion = await Publicaciones.create({
    user_id: usuario.id,
    tipo: 'VIDEO',
    url_media: upload.secure_url,
    caption: 'Prueba video — test-cloudinary-video.mjs'
  });

  const verificacion = await Publicaciones.findByPk(publicacion.id);
  console.log('✅ Publicación VIDEO en BD:', {
    id: verificacion.id,
    tipo: verificacion.tipo,
    url_media: verificacion.url_media
  });
};

main()
  .catch((err) => {
    console.error('❌ Error:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
