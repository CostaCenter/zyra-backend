-- Entrenamientos: campos operativos, confirmaciones RSVP y vínculo con partido de práctica

ALTER TABLE club_eventos
  ADD COLUMN IF NOT EXISTS fecha_hora_fin TIMESTAMP,
  ADD COLUMN IF NOT EXISTS dias_recurrencia SMALLINT[],
  ADD COLUMN IF NOT EXISTS enfoque_sesion VARCHAR(64),
  ADD COLUMN IF NOT EXISTS metricas_a_evaluar JSONB,
  ADD COLUMN IF NOT EXISTS cupo_limite INTEGER,
  ADD COLUMN IF NOT EXISTS indumentaria_sugerida JSONB,
  ADD COLUMN IF NOT EXISTS partido_id INTEGER REFERENCES partidos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evento_serie_id INTEGER REFERENCES club_eventos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_club_eventos_partido ON club_eventos (partido_id);

CREATE TABLE IF NOT EXISTS club_evento_confirmaciones (
    id              SERIAL PRIMARY KEY,
    evento_id       INTEGER NOT NULL REFERENCES club_eventos(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES "user"(id),
    respuesta       VARCHAR(16) NOT NULL DEFAULT 'SIN_RESPONDER',
    respondido_at   TIMESTAMP,

    CONSTRAINT uq_evento_usuario_confirmacion UNIQUE (evento_id, usuario_id),
    CONSTRAINT chk_confirmacion_respuesta CHECK (
        respuesta IN ('VOY', 'NO_VOY', 'SIN_RESPONDER')
    )
);

CREATE INDEX IF NOT EXISTS idx_club_evento_conf_evento ON club_evento_confirmaciones (evento_id);
CREATE INDEX IF NOT EXISTS idx_club_evento_conf_usuario ON club_evento_confirmaciones (usuario_id);
