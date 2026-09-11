-- Badge del bottom nav vs. indicador "no leída" en lista.
-- vista_bandeja: se marca al abrir la bandeja (resetea contador).
-- leida: se marca al abrir la notificación (punto/estilo en la lista).

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS vista_bandeja BOOLEAN NOT NULL DEFAULT FALSE;

-- Las ya leídas no deben reaparecer en el badge.
UPDATE notificaciones
SET vista_bandeja = TRUE
WHERE leida = TRUE AND vista_bandeja = FALSE;

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_vista_bandeja
  ON notificaciones (usuario_id, vista_bandeja);
