-- migrations/008_torneo_inscripciones.sql
-- Solicitudes e invitaciones de inscripción de equipos a torneos.

CREATE TABLE torneo_inscripciones (
    id                  SERIAL PRIMARY KEY,
    torneo_id           INTEGER NOT NULL REFERENCES torneos(id),
    team_id             INTEGER NOT NULL REFERENCES "Team"(id),
    origen              VARCHAR(20) NOT NULL,
    iniciado_por_id     INTEGER NOT NULL REFERENCES "user"(id),
    estado              VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    resuelto_por_id     INTEGER REFERENCES "user"(id),
    resuelto_at         TIMESTAMP,
    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_origen CHECK (origen IN ('SOLICITUD_EQUIPO', 'INVITACION_TORNEO')),
    CONSTRAINT chk_estado_inscripcion CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA'))
);

CREATE UNIQUE INDEX uq_torneo_team_activa
  ON torneo_inscripciones (torneo_id, team_id)
  WHERE estado IN ('PENDIENTE', 'ACEPTADA');
-- Un equipo puede reintentar tras ser RECHAZADA (nueva fila), pero no
-- puede tener dos solicitudes PENDIENTE/ACEPTADA simultáneas al mismo
-- torneo.
