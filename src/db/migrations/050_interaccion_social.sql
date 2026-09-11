-- Reacciones, comentarios y encuestas polimórficas (AVISO | PUBLICACION)

CREATE TABLE IF NOT EXISTS contenido_reacciones (
    id              SERIAL PRIMARY KEY,
    contenido_tipo  VARCHAR(20) NOT NULL,
    contenido_id    INTEGER NOT NULL,
    usuario_id      INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    tipo_reaccion   VARCHAR(20) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contenido_reaccion_usuario UNIQUE (contenido_tipo, contenido_id, usuario_id),
    CONSTRAINT chk_contenido_reaccion_tipo CHECK (contenido_tipo IN ('AVISO', 'PUBLICACION')),
    CONSTRAINT chk_tipo_reaccion CHECK (tipo_reaccion IN ('FUEGO', 'FUERZA', 'APLAUSOS', 'RISA', 'CORAZON'))
);

CREATE INDEX IF NOT EXISTS idx_contenido_reacciones_contenido
    ON contenido_reacciones (contenido_tipo, contenido_id);

CREATE TABLE IF NOT EXISTS contenido_comentarios (
    id              SERIAL PRIMARY KEY,
    contenido_tipo  VARCHAR(20) NOT NULL,
    contenido_id    INTEGER NOT NULL,
    usuario_id      INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    texto           TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_contenido_comentario_tipo CHECK (contenido_tipo IN ('AVISO', 'PUBLICACION'))
);

CREATE INDEX IF NOT EXISTS idx_contenido_comentarios_contenido
    ON contenido_comentarios (contenido_tipo, contenido_id, created_at DESC);

CREATE TABLE IF NOT EXISTS encuestas (
    id              SERIAL PRIMARY KEY,
    contenido_tipo  VARCHAR(20) NOT NULL,
    contenido_id    INTEGER NOT NULL,
    pregunta        VARCHAR(500) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_encuesta_contenido UNIQUE (contenido_tipo, contenido_id),
    CONSTRAINT chk_encuesta_contenido_tipo CHECK (contenido_tipo IN ('AVISO', 'PUBLICACION'))
);

CREATE TABLE IF NOT EXISTS encuesta_opciones (
    id              SERIAL PRIMARY KEY,
    encuesta_id     INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    texto_opcion    VARCHAR(255) NOT NULL,
    orden           SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_encuesta_opciones_encuesta ON encuesta_opciones (encuesta_id);

CREATE TABLE IF NOT EXISTS encuesta_votos (
    id                  SERIAL PRIMARY KEY,
    encuesta_id         INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    encuesta_opcion_id  INTEGER NOT NULL REFERENCES encuesta_opciones(id) ON DELETE CASCADE,
    usuario_id          INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_encuesta_voto_usuario UNIQUE (encuesta_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_encuesta_votos_opcion ON encuesta_votos (encuesta_opcion_id);
