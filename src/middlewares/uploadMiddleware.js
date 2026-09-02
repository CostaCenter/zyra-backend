import multer from 'multer';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (videos cortos piloto)

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const mime = file.mimetype?.toLowerCase() || '';
  const nombre = file.originalname?.toLowerCase() || '';

  const mimeOk =
    /^(image\/(jpeg|jpg|png|gif|webp|heic|heif|pjpeg)|video\/(mp4|quicktime|webm|mpeg))$/i.test(mime);

  const extOk = /\.(jpe?g|png|gif|webp|heic|heif|mp4|mov|webm)$/i.test(nombre);

  if (mimeOk || (mime === 'application/octet-stream' && extOk)) {
    cb(null, true);
    return;
  }

  cb(new Error('Tipo de archivo no permitido. Usa imagen (JPEG, PNG, WebP) o video (MP4, MOV).'));
};

export const uploadPublicacionMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
}).single('media');

const imageOnlyFilter = (_req, file, cb) => {
  const mime = file.mimetype?.toLowerCase() || '';
  const nombre = file.originalname?.toLowerCase() || '';
  const mimeOk = /^image\/(jpeg|jpg|png|gif|webp|heic|heif|pjpeg)$/i.test(mime);
  const extOk = /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(nombre);

  if (mimeOk || (mime === 'application/octet-stream' && extOk)) {
    cb(null, true);
    return;
  }

  cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP).'));
};

export const uploadTorneoPhoto = multer({
  storage,
  fileFilter: imageOnlyFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('photo');

/** Avatar de usuario — mismas reglas que foto de torneo. */
export const uploadUsuarioPhoto = uploadTorneoPhoto;

export const handleMulterError = (err, req, res, next) => {
  if (!err) {
    next();
    return;
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'El archivo supera el tamaño máximo permitido (50 MB)'
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || 'Error al procesar el archivo'
  });
};
