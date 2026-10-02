-- Actividad general (debounced desde auth) y eventos sociales para retención

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS user_activity_events (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tipo            VARCHAR(40) NOT NULL,
  entidad_tipo    VARCHAR(40),
  entidad_id      INTEGER,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_user_activity_tipo CHECK (tipo IN (
    'RSVP',
    'REACCION',
    'COMENTARIO',
    'VOTO_ENCUESTA',
    'ASISTENCIA_MARCADA',
    'PAGO_REGISTRADO',
    'PUBLICACION_CREADA',
    'INSCRIPCION_TORNEO'
  ))
);

CREATE INDEX IF NOT EXISTS idx_user_activity_events_usuario_occurred
  ON user_activity_events (usuario_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_activity_events_occurred
  ON user_activity_events (occurred_at DESC);
