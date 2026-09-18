/**
 * Configuración de versión móvil vía variables de entorno (Railway / .env).
 *
 * APP_LATEST_VERSION   — última versión publicada (ej. 1.0.1)
 * APP_MIN_VERSION      — mínima obligatoria (ej. 1.0.0); si no se define, usa latest
 * APP_DOWNLOAD_URL     — enlace directo al APK (GitHub Releases, Drive, etc.)
 * APP_UPDATE_MESSAGE   — texto opcional para el modal
 */
export const getAppVersionConfig = async (_req, res) => {
  const latestVersion = process.env.APP_LATEST_VERSION?.trim() || '1.0.0';
  const minVersion = process.env.APP_MIN_VERSION?.trim() || latestVersion;
  const downloadUrl = process.env.APP_DOWNLOAD_URL?.trim() || null;
  const message = process.env.APP_UPDATE_MESSAGE?.trim() || null;

  return res.status(200).json({
    success: true,
    data: {
      latest_version: latestVersion,
      min_version: minVersion,
      download_url: downloadUrl,
      message,
    },
  });
};
