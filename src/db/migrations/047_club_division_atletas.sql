-- Nómina de atletas a nivel de división

CREATE TABLE IF NOT EXISTS club_division_atletas (
    id                  SERIAL PRIMARY KEY,
    club_division_id    INTEGER NOT NULL REFERENCES club_divisiones(id) ON DELETE CASCADE,
    usuario_id          INTEGER NOT NULL REFERENCES "user"(id),
    dorsal              SMALLINT,
    posicion            VARCHAR(64),
    estado              VARCHAR(16) NOT NULL DEFAULT 'ACTIVO',
    fecha_ingreso       TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_club_division_atleta UNIQUE (club_division_id, usuario_id),
    CONSTRAINT chk_club_division_atleta_estado CHECK (estado IN ('ACTIVO', 'LESIONADO', 'INACTIVO'))
);

CREATE INDEX IF NOT EXISTS idx_club_division_atletas_division ON club_division_atletas (club_division_id);
CREATE INDEX IF NOT EXISTS idx_club_division_atletas_usuario ON club_division_atletas (usuario_id);

-- Migrar jugadores existentes desde equipos del club
INSERT INTO club_division_atletas (club_division_id, usuario_id, dorsal, posicion, estado, fecha_ingreso)
SELECT DISTINCT ON (t.club_division_id, tm.user_id)
    t.club_division_id,
    tm.user_id,
    tm.dorsal_habitual,
    NULLIF(TRIM(tm.position), ''),
    'ACTIVO',
    COALESCE(tm.fecha_union, NOW())
FROM "Team_Miembros" tm
INNER JOIN "Team" t ON t.id = tm.team_id
WHERE t.club_id IS NOT NULL
  AND t.club_division_id IS NOT NULL
  AND tm.estado_invitacion = 'ACEPTADO'
ORDER BY t.club_division_id, tm.user_id, tm.id
ON CONFLICT (club_division_id, usuario_id) DO NOTHING;
