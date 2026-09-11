-- Solicitudes de membresía individual al club (unión por código)
-- Distinto de club_solicitudes (unión de equipos).

CREATE TABLE IF NOT EXISTS club_membresia_solicitudes (
    id                  SERIAL PRIMARY KEY,
    club_id             INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    usuario_id          INTEGER NOT NULL REFERENCES "user"(id),
    estado              VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    origen              VARCHAR(32) NOT NULL DEFAULT 'CODIGO',
    resuelto_por_id     INTEGER REFERENCES "user"(id),
    rol_asignado        VARCHAR(32),
    resuelto_at         TIMESTAMP,
    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_club_membresia_solicitud_estado
      CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA')),
    CONSTRAINT chk_club_membresia_solicitud_origen
      CHECK (origen IN ('CODIGO'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_club_membresia_solicitud_pendiente
  ON club_membresia_solicitudes (club_id, usuario_id)
  WHERE estado = 'PENDIENTE';

CREATE INDEX IF NOT EXISTS idx_club_membresia_solicitudes_club
  ON club_membresia_solicitudes (club_id);

CREATE INDEX IF NOT EXISTS idx_club_membresia_solicitudes_usuario
  ON club_membresia_solicitudes (usuario_id);

-- Ampliar roles de membresía (ejemplos de unión por código)
ALTER TABLE club_miembros DROP CONSTRAINT IF EXISTS chk_club_miembro_rol;

ALTER TABLE club_miembros
  ADD CONSTRAINT chk_club_miembro_rol CHECK (
    rol_membresia IN (
      'ADMIN',
      'ENCARGADO',
      'ENTRENADOR',
      'STAFF',
      'MIEMBRO',
      'ATLETA',
      'SOCIO',
      'VOLUNTARIO',
      'PADRE_FAMILIA'
    )
  );
