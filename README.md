# ZyraBackend

API backend de Zyra (Node.js, Express, Sequelize, PostgreSQL, Socket.io, Cloudinary).

## Requisitos

- Node.js 18+
- PostgreSQL

## Configuración local

1. Copia las variables de entorno:
   ```bash
   cp .env.example .env
   ```
2. Completa `.env` con tus credenciales (JWT, DB, Cloudinary).
3. Instala dependencias:
   ```bash
   npm install
   ```
4. Ejecuta migraciones:
   ```bash
   npm run migrate:all
   ```
5. Arranca el servidor:
   ```bash
   npm run dev
   ```

## Deploy en Railway

- **Start command:** `node src/app.js` (ver `Procfile` y `railway.toml`)
- Conecta el plugin **PostgreSQL** y usa `DATABASE_URL`
- Configura `JWT_SECRET` y las variables de Cloudinary
- Tras el deploy, corre migraciones contra la base de Railway:
  ```bash
  DATABASE_URL="postgresql://..." npm run migrate:all
  ```

## Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm start` | Servidor en producción |
| `npm run dev` | Servidor con nodemon |
| `npm run migrate:all` | Todas las migraciones SQL en orden |
"# ZyraBackend" 
