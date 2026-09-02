# Configuración Cloudinary — Zyra (piloto)

## 1. Crear cuenta (gratis)

1. Ve a [https://cloudinary.com](https://cloudinary.com) y regístrate (plan **Free** es suficiente para el piloto).
2. En el **Dashboard** verás:
   - **Cloud name**
   - **API Key**
   - **API Secret** (clic en “reveal”)

## 2. Variables de entorno

Agrega esto a tu `.env` del backend (`backend-zyra/.env`):

```env
# Opción A — recomendada (una sola línea del Dashboard):
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@dr8pv3hga

# Opción B — variables separadas:
CLOUDINARY_CLOUD_NAME=dr8pv3hga
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# Carpeta en Media Library:
CLOUDINARY_FOLDER=ZyraEnterprise
```

> Nunca subas el API Secret a git.

## 3. Migración de tablas

```bash
node scripts/run-migration-012-publicaciones.mjs
```

## 4. Probar subida + guardado en BD

```bash
node scripts/test-cloudinary-publicacion.mjs
```

Opciones:

```bash
node scripts/test-cloudinary-publicacion.mjs --user-id=1
node scripts/test-cloudinary-publicacion.mjs --image=./foto-prueba.jpg
```

El script sube una imagen a Cloudinary, guarda `secure_url` en `publicaciones.url_media` y verifica que coincida.

## Error 403 "missing permissions (create)"

Si ves este error, tu **API Key no tiene permiso de subida**. Dos soluciones:

### Opción A — Habilitar permiso en la API Key (recomendado)

1. [cloudinary.com/console](https://cloudinary.com/console)
2. **Settings** (⚙️) → **Product environment** → **API Keys**
3. Edita la key `442469778384366` (o crea una nueva)
4. Activa permiso **Upload** / **Create**
5. Guarda y reinicia el backend

### Opción B — Upload Preset unsigned

1. **Settings** → **Upload** → **Upload presets** → **Add upload preset**
2. **Preset name:** `zyra_publicaciones`
3. **Signing mode:** **Unsigned**
4. **Folder:** `ZyraEnterprise` (opcional)
5. En `.env` agrega: `CLOUDINARY_UPLOAD_PRESET=zyra_publicaciones`
6. Reinicia el backend

## Carpeta de medios

Los archivos se suben a la carpeta **`ZyraEnterprise`** en tu Media Library de Cloudinary.
Puedes cambiarla con `CLOUDINARY_FOLDER` en `.env`.

## 5. Endpoint de la app

`POST /api/publicaciones` (multipart/form-data, Bearer token):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `media` | file | Imagen o video |
| `caption` | string | Opcional |
| `sport_ids` | JSON string | Ej: `[1,2]` — vacío = publicación general |
| `etiquetados` | JSON string | Ej: `[3,5]` — IDs de usuarios etiquetados |

El archivo **no** se guarda en disco ni en Postgres; solo la `secure_url` de Cloudinary.
