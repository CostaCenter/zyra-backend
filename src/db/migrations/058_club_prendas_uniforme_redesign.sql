-- Rediseño: prendas configurables, asignaciones por prenda e historial de estados

CREATE TABLE IF NOT EXISTS club_prendas_uniforme (
    id              SERIAL PRIMARY KEY,
    club_id         INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    nombre          VARCHAR(64) NOT NULL,
    sistema_talla   VARCHAR(16) NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_club_prenda_sistema CHECK (sistema_talla IN ('ROPA', 'CALZADO', 'PROTECCION')),
    CONSTRAINT uq_club_prenda_nombre UNIQUE (club_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_club_prendas_uniforme_club ON club_prendas_uniforme (club_id);

-- Datos legacy (1 fila por jugador/división) no son compatibles con el nuevo modelo
DELETE FROM club_uniforme_asignaciones;

ALTER TABLE club_uniforme_asignaciones DROP CONSTRAINT IF EXISTS uq_club_uniforme_usuario_division;
ALTER TABLE club_uniforme_asignaciones DROP COLUMN IF EXISTS concepto_pago_id;

ALTER TABLE club_uniforme_asignaciones
    ADD COLUMN IF NOT EXISTS prenda_id INTEGER REFERENCES club_prendas_uniforme(id) ON DELETE CASCADE;

ALTER TABLE club_uniforme_asignaciones
    ADD COLUMN IF NOT EXISTS cantidad SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE club_uniforme_asignaciones
    ADD COLUMN IF NOT EXISTS estado_actual VARCHAR(16) NOT NULL DEFAULT 'NUEVO';

ALTER TABLE club_uniforme_asignaciones
    DROP CONSTRAINT IF EXISTS chk_club_uniforme_estado;

ALTER TABLE club_uniforme_asignaciones
    ADD CONSTRAINT chk_club_uniforme_estado
    CHECK (estado_actual IN ('NUEVO', 'BUEN_ESTADO', 'DESGASTADO', 'DAÑADO', 'REEMPLAZAR'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_club_uniforme_usuario_div_prenda
    ON club_uniforme_asignaciones (usuario_id, club_division_id, prenda_id);

CREATE INDEX IF NOT EXISTS idx_club_uniforme_prenda ON club_uniforme_asignaciones (prenda_id);

CREATE TABLE IF NOT EXISTS club_uniforme_historial (
    id                  SERIAL PRIMARY KEY,
    asignacion_id       INTEGER NOT NULL REFERENCES club_uniforme_asignaciones(id) ON DELETE CASCADE,
    estado_anterior     VARCHAR(16),
    estado_nuevo        VARCHAR(16) NOT NULL,
    fecha_cambio        TIMESTAMP NOT NULL DEFAULT NOW(),
    registrado_por_id   INTEGER REFERENCES "user"(id),
    notas               TEXT,
    CONSTRAINT chk_uniforme_hist_estado_nuevo CHECK (
        estado_nuevo IN ('NUEVO', 'BUEN_ESTADO', 'DESGASTADO', 'DAÑADO', 'REEMPLAZAR')
    )
);

CREATE INDEX IF NOT EXISTS idx_club_uniforme_historial_asignacion ON club_uniforme_historial (asignacion_id);
