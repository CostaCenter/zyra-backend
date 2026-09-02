-- Tokens Expo Push por dispositivo (un usuario puede tener varios)

CREATE TABLE IF NOT EXISTS dispositivos_push (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  push_token  VARCHAR(255) NOT NULL,
  plataforma  VARCHAR(10) NOT NULL CHECK (plataforma IN ('ios', 'android')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dispositivos_push_token
  ON dispositivos_push (push_token);

CREATE INDEX IF NOT EXISTS idx_dispositivos_push_usuario
  ON dispositivos_push (usuario_id);

COMMENT ON TABLE dispositivos_push IS 'Expo push tokens por usuario y dispositivo';
