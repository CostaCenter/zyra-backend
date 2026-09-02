-- Migración: Agregar cancha_id a configuracion_horarios_favoritos
-- Cada favorito queda asociado a una cancha específica (única por cancha)

ALTER TABLE configuracion_horarios_favoritos
ADD COLUMN IF NOT EXISTS cancha_id INTEGER REFERENCES canchas(id) ON DELETE CASCADE;

-- Limpiar registros antiguos sin cancha asociada
DELETE FROM configuracion_horarios_favoritos WHERE cancha_id IS NULL;

ALTER TABLE configuracion_horarios_favoritos
ALTER COLUMN cancha_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_configuracion_horarios_favoritos_cancha_id
ON configuracion_horarios_favoritos(cancha_id);

COMMENT ON COLUMN configuracion_horarios_favoritos.cancha_id IS 'Cancha a la que pertenece esta configuración favorita';
