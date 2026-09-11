-- Extensión interacciones: reportes, replies a comentarios, reacciones en comentarios

-- 1) Reacciones: permitir COMENTARIO
ALTER TABLE contenido_reacciones
  DROP CONSTRAINT IF EXISTS chk_contenido_reaccion_tipo;
ALTER TABLE contenido_reacciones
  ADD CONSTRAINT chk_contenido_reaccion_tipo
  CHECK (contenido_tipo IN ('AVISO', 'PUBLICACION', 'COMENTARIO'));

-- 2) Comentarios: un nivel de respuesta (comentario → respuesta)
ALTER TABLE contenido_comentarios
  ADD COLUMN IF NOT EXISTS comentario_padre_id INTEGER
  REFERENCES contenido_comentarios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contenido_comentarios_padre
  ON contenido_comentarios (comentario_padre_id)
  WHERE comentario_padre_id IS NOT NULL;

-- 3) Reportes de contenido (cumplimiento stores / Guideline 1.2)
CREATE TABLE IF NOT EXISTS contenido_reportes (
  id                SERIAL PRIMARY KEY,
  contenido_tipo    VARCHAR(20) NOT NULL,
  contenido_id      INTEGER NOT NULL,
  reportado_por_id  INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  motivo            TEXT NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_reporte_contenido_tipo
    CHECK (contenido_tipo IN ('AVISO', 'PUBLICACION', 'COMENTARIO')),
  CONSTRAINT chk_reporte_estado
    CHECK (estado IN ('PENDIENTE', 'REVISADO', 'DESCARTADO', 'ACCION_TOMADA')),
  CONSTRAINT uq_reporte_usuario_contenido
    UNIQUE (contenido_tipo, contenido_id, reportado_por_id)
);

CREATE INDEX IF NOT EXISTS idx_contenido_reportes_estado
  ON contenido_reportes (estado, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contenido_reportes_contenido
  ON contenido_reportes (contenido_tipo, contenido_id);
