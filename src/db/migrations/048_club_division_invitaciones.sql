-- Invitaciones de usuarios a nómina de división de club

CREATE TABLE IF NOT EXISTS club_division_invitaciones (
    id                  SERIAL PRIMARY KEY,
    club_division_id    INTEGER NOT NULL REFERENCES club_divisiones(id) ON DELETE CASCADE,
    usuario_invitado_id INTEGER NOT NULL REFERENCES "user"(id),
    invitado_por_id     INTEGER NOT NULL REFERENCES "user"(id),
    estado              VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE',
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_club_division_invitacion_estado CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_club_division_invitacion_pendiente
    ON club_division_invitaciones (club_division_id, usuario_invitado_id)
    WHERE estado = 'PENDIENTE';

CREATE INDEX IF NOT EXISTS idx_club_division_invitaciones_division
    ON club_division_invitaciones (club_division_id);

CREATE INDEX IF NOT EXISTS idx_club_division_invitaciones_invitado
    ON club_division_invitaciones (usuario_invitado_id);
