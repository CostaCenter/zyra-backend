import { Readable } from 'stream';
import cloudinary, { isCloudinaryConfigured, getCloudinaryConfig } from '../config/cloudinary.js';

const FOLDER = process.env.CLOUDINARY_FOLDER || 'ZyraEnterprise';
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || '';
const MAX_DATA_URI_BYTES = 8 * 1024 * 1024;

const MIME_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg'
};

const mimePorExtension = (nombre = '') => {
  if (/\.(mp4|m4v)$/i.test(nombre)) return 'video/mp4';
  if (/\.(mov|qt)$/i.test(nombre)) return 'video/quicktime';
  if (/\.webm$/i.test(nombre)) return 'video/webm';
  if (/\.png$/i.test(nombre)) return 'image/png';
  if (/\.webp$/i.test(nombre)) return 'image/webp';
  if (/\.gif$/i.test(nombre)) return 'image/gif';
  if (/\.(jpe?g)$/i.test(nombre)) return 'image/jpeg';
  return null;
};

export const normalizarMimeType = (file) => {
  const raw = file.mimetype?.toLowerCase() || '';
  const nombre = file.originalname?.toLowerCase() || '';
  const porExt = mimePorExtension(nombre);

  if (raw.startsWith('video/')) return raw;
  if (porExt?.startsWith('video/')) return porExt;

  if (raw.startsWith('image/')) return raw;
  if (porExt?.startsWith('image/')) return porExt;

  if (raw === 'application/octet-stream' && porExt) return porExt;

  if (MIME_ALIASES[raw]) return MIME_ALIASES[raw];

  return raw || porExt || 'image/jpeg';
};

const asegurarConfig = () => {
  const cfg = getCloudinaryConfig();
  if (cfg.cloud_name && cfg.api_key && cfg.api_secret) {
    cloudinary.config({ ...cfg, secure: true });
  }
};

const subirBuffer = (buffer, options) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    Readable.from(buffer).pipe(uploadStream);
  });

const opcionesUpload = (resourceType) => {
  const base = {
    folder: FOLDER,
    resource_type: resourceType,
    overwrite: true
  };

  if (UPLOAD_PRESET) {
    return { ...base, upload_preset: UPLOAD_PRESET };
  }

  return base;
};

export const subirMediaPublicacion = async (file) => {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary no está configurado. Revisa CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en .env'
    );
  }

  if (!file?.buffer?.length) {
    throw new Error('No se recibió archivo de media');
  }

  asegurarConfig();

  const mimetype = normalizarMimeType(file);
  const esVideo = mimetype.startsWith('video/');
  const resourceType = esVideo ? 'video' : 'image';
  const opts = opcionesUpload(resourceType);

  const usarStream = esVideo || file.buffer.length > MAX_DATA_URI_BYTES;
  const result = usarStream
    ? await subirBuffer(file.buffer, opts)
    : await cloudinary.uploader.upload(
        `data:${mimetype};base64,${file.buffer.toString('base64')}`,
        opts
      );

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
    width: result.width ?? null,
    height: result.height ?? null
  };
};

/** Imagen de perfil (torneo, etc.) — solo image resource. */
export const subirImagenPerfil = async (file, subfolder = 'perfiles') => {
  if (!file?.buffer?.length) {
    throw new Error('No se recibió archivo de imagen');
  }

  const mimetype = normalizarMimeType(file);
  if (!mimetype.startsWith('image/')) {
    throw new Error('Solo se permiten imágenes');
  }

  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary no está configurado. Revisa CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en .env'
    );
  }

  asegurarConfig();

  const opts = {
    ...opcionesUpload('image'),
    folder: `${FOLDER}/${subfolder}`,
  };

  const result = file.buffer.length > MAX_DATA_URI_BYTES
    ? await subirBuffer(file.buffer, opts)
    : await cloudinary.uploader.upload(
        `data:${mimetype};base64,${file.buffer.toString('base64')}`,
        opts
      );

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
  };
};

export const inferirTipoPublicacion = (mimetype = '', originalname = '') => {
  const normalizado = normalizarMimeType({ mimetype, originalname });
  return normalizado.startsWith('video/') ? 'VIDEO' : 'FOTO';
};

export const formatearErrorCloudinary = (error) => {
  if (!error) return 'Error desconocido al subir a Cloudinary';

  const detalle = error.error?.message || error.message || '';

  const es403 =
    error.http_code === 403 ||
    detalle.includes('403') ||
    detalle.includes('missing permissions') ||
    detalle.includes('actions=["create"]');

  if (es403) {
    return (
      'Cloudinary bloqueó la subida: tu API Key no tiene permiso de Upload. ' +
      'Entra a cloudinary.com/console → Settings → API Keys → edita la key y activa Upload/Create. ' +
      'Alternativa: crea un Upload Preset unsigned llamado zyra_publicaciones y en .env agrega CLOUDINARY_UPLOAD_PRESET=zyra_publicaciones'
    );
  }

  return detalle || 'Error al subir archivo a Cloudinary';
};
