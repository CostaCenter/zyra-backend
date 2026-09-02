-- Flag para datos de prueba locales (seed). NUNCA usar en producción.
-- Ejecutar: node scripts/run-migration-015-es-dato-prueba.mjs

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS es_dato_prueba BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Team"
  ADD COLUMN IF NOT EXISTS es_dato_prueba BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE publicaciones
  ADD COLUMN IF NOT EXISTS es_dato_prueba BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE seguidores
  ADD COLUMN IF NOT EXISTS es_dato_prueba BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_es_dato_prueba ON "user" (es_dato_prueba) WHERE es_dato_prueba = true;
CREATE INDEX IF NOT EXISTS idx_team_es_dato_prueba ON "Team" (es_dato_prueba) WHERE es_dato_prueba = true;
CREATE INDEX IF NOT EXISTS idx_publicaciones_es_dato_prueba ON publicaciones (es_dato_prueba) WHERE es_dato_prueba = true;
CREATE INDEX IF NOT EXISTS idx_seguidores_es_dato_prueba ON seguidores (es_dato_prueba) WHERE es_dato_prueba = true;
