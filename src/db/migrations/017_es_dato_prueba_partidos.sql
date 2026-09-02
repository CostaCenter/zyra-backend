-- Flag es_dato_prueba para partidos y torneos seed (solo local).
-- Ejecutar: node scripts/run-migration-017-es-dato-prueba-partidos.mjs

ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS es_dato_prueba BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS es_dato_prueba BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_partidos_es_dato_prueba ON partidos (es_dato_prueba) WHERE es_dato_prueba = true;
CREATE INDEX IF NOT EXISTS idx_torneos_es_dato_prueba ON torneos (es_dato_prueba) WHERE es_dato_prueba = true;
