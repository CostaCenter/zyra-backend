-- Centro de notificaciones in-app

CREATE TABLE IF NOT EXISTS notificaciones (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tipo            VARCHAR(50) NOT NULL,
  mensaje         TEXT NOT NULL,
  referencia_id   INTEGER,
  referencia_tipo VARCHAR(50),
  leida           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida
  ON notificaciones (usuario_id, leida);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_created
  ON notificaciones (usuario_id, created_at DESC);

COMMENT ON TABLE notificaciones IS 'Notificaciones in-app por usuario';
COMMENT ON COLUMN notificaciones.tipo IS 'INVITACION_EQUIPO, SOLICITUD_INSCRIPCION, ASIGNACION_ARBITRO, NOMINA_PROPUESTA, RESULTADO_PARTIDO, NUEVO_SEGUIDOR, ETIQUETA_PENDIENTE';
