-- Gestión de club: miembros, comunicados, eventos, asistencia, evaluación, prácticas por división

-- División obligatoria: backfill "Plantel Principal" para clubes existentes
INSERT INTO club_divisiones (club_id, nombre, genero, categoria_edad)
SELECT c.id, 'Plantel Principal', 'MIXTO', NULL
FROM clubs c
WHERE NOT EXISTS (SELECT 1 FROM club_divisiones d WHERE d.club_id = c.id);

UPDATE "Team" t
SET club_division_id = d.id
FROM club_divisiones d
WHERE t.club_id = d.club_id
  AND t.club_division_id IS NULL
  AND d.nombre = 'Plantel Principal';

UPDATE club_solicitudes s
SET club_division_id = d.id
FROM club_divisiones d
WHERE s.club_id = d.club_id
  AND s.club_division_id IS NULL
  AND s.estado IN ('PENDIENTE', 'ACEPTADA')
  AND d.nombre = 'Plantel Principal';

-- Miembros del club
CREATE TABLE IF NOT EXISTS club_miembros (
    id              SERIAL PRIMARY KEY,
    club_id         INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES "user"(id),
    rol_membresia   VARCHAR(32) NOT NULL,
    fecha_ingreso   TIMESTAMP NOT NULL DEFAULT NOW(),
    estado          VARCHAR(16) NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT uq_club_miembro_usuario UNIQUE (club_id, usuario_id),
    CONSTRAINT chk_club_miembro_rol CHECK (
        rol_membresia IN ('ADMIN', 'ENCARGADO', 'ENTRENADOR', 'STAFF', 'MIEMBRO')
    ),
    CONSTRAINT chk_club_miembro_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE INDEX IF NOT EXISTS idx_club_miembros_club ON club_miembros (club_id);
CREATE INDEX IF NOT EXISTS idx_club_miembros_usuario ON club_miembros (usuario_id);

-- Asegurar unique si la tabla existía sin constraint (re-ejecución parcial)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_club_miembro_usuario'
  ) THEN
    ALTER TABLE club_miembros
      ADD CONSTRAINT uq_club_miembro_usuario UNIQUE (club_id, usuario_id);
  END IF;
END $$;

-- Backfill admin como miembro ADMIN
INSERT INTO club_miembros (club_id, usuario_id, rol_membresia, estado, fecha_ingreso)
SELECT c.id, c.admin_id, 'ADMIN', 'ACTIVO', NOW()
FROM clubs c
WHERE c.admin_id IS NOT NULL
ON CONFLICT (club_id, usuario_id) DO NOTHING;

-- Backfill encargados de división
INSERT INTO club_miembros (club_id, usuario_id, rol_membresia, estado, fecha_ingreso)
SELECT d.club_id, d.encargado_id, 'ENCARGADO', 'ACTIVO', NOW()
FROM club_divisiones d
WHERE d.encargado_id IS NOT NULL
ON CONFLICT (club_id, usuario_id) DO UPDATE
SET rol_membresia = EXCLUDED.rol_membresia, estado = 'ACTIVO';

-- Comunicados
CREATE TABLE IF NOT EXISTS club_anuncios (
    id                  SERIAL PRIMARY KEY,
    club_id             INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    club_division_id    INTEGER REFERENCES club_divisiones(id) ON DELETE CASCADE,
    equipo_id           INTEGER REFERENCES "Team"(id) ON DELETE CASCADE,
    autor_id            INTEGER NOT NULL REFERENCES "user"(id),
    titulo              VARCHAR(255) NOT NULL,
    texto               TEXT NOT NULL,
    importancia         VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_club_anuncio_importancia CHECK (importancia IN ('NORMAL', 'IMPORTANTE'))
);

CREATE INDEX IF NOT EXISTS idx_club_anuncios_club ON club_anuncios (club_id);
CREATE INDEX IF NOT EXISTS idx_club_anuncios_division ON club_anuncios (club_division_id);
CREATE INDEX IF NOT EXISTS idx_club_anuncios_equipo ON club_anuncios (equipo_id);

-- Eventos / entrenamientos (siempre por división)
CREATE TABLE IF NOT EXISTS club_eventos (
    id                  SERIAL PRIMARY KEY,
    club_division_id    INTEGER NOT NULL REFERENCES club_divisiones(id) ON DELETE CASCADE,
    tipo                VARCHAR(32) NOT NULL,
    titulo              VARCHAR(255) NOT NULL,
    descripcion         TEXT,
    fecha_hora          TIMESTAMP NOT NULL,
    lugar               VARCHAR(255),
    recurrente          BOOLEAN NOT NULL DEFAULT FALSE,
    creado_por_id       INTEGER NOT NULL REFERENCES "user"(id),
    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_club_evento_tipo CHECK (
        tipo IN ('ENTRENAMIENTO', 'REUNION', 'EVENTO_SOCIAL', 'PRUEBA', 'CONVOCATORIA')
    )
);

CREATE INDEX IF NOT EXISTS idx_club_eventos_division ON club_eventos (club_division_id);
CREATE INDEX IF NOT EXISTS idx_club_eventos_fecha ON club_eventos (fecha_hora);

-- Asistencia a eventos
CREATE TABLE IF NOT EXISTS club_evento_asistencias (
    id              SERIAL PRIMARY KEY,
    evento_id       INTEGER NOT NULL REFERENCES club_eventos(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES "user"(id),
    estado          VARCHAR(16) NOT NULL,
    registrado_por  INTEGER NOT NULL REFERENCES "user"(id),
    creado_at       TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_evento_usuario_asistencia UNIQUE (evento_id, usuario_id),
    CONSTRAINT chk_asistencia_estado CHECK (estado IN ('PRESENTE', 'AUSENTE', 'JUSTIFICADO'))
);

CREATE INDEX IF NOT EXISTS idx_club_evento_asist_evento ON club_evento_asistencias (evento_id);

-- Métricas de evaluación por deporte
CREATE TABLE IF NOT EXISTS club_metrica_evaluacion (
    id              SERIAL PRIMARY KEY,
    sport_id        INTEGER NOT NULL REFERENCES sports(id),
    nombre_metrica  VARCHAR(128) NOT NULL,
    categoria       VARCHAR(16) NOT NULL,

    CONSTRAINT uq_metrica_sport_nombre UNIQUE (sport_id, nombre_metrica),
    CONSTRAINT chk_metrica_categoria CHECK (categoria IN ('TECNICO', 'FISICO', 'ACTITUDINAL'))
);

CREATE INDEX IF NOT EXISTS idx_club_metrica_sport ON club_metrica_evaluacion (sport_id);

-- Semilla vóley (sport_id = 2)
INSERT INTO club_metrica_evaluacion (sport_id, nombre_metrica, categoria)
SELECT 2, m.nombre, m.categoria
FROM (VALUES
    ('Saque', 'TECNICO'),
    ('Recepción', 'TECNICO'),
    ('Ataque', 'TECNICO'),
    ('Bloqueo', 'TECNICO'),
    ('Defensa', 'TECNICO'),
    ('Actitud', 'ACTITUDINAL')
) AS m(nombre, categoria)
WHERE EXISTS (SELECT 1 FROM sports WHERE id = 2)
ON CONFLICT (sport_id, nombre_metrica) DO NOTHING;

-- Evaluaciones de rendimiento en evento
CREATE TABLE IF NOT EXISTS club_evento_evaluacion (
    id              SERIAL PRIMARY KEY,
    evento_id       INTEGER NOT NULL REFERENCES club_eventos(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES "user"(id),
    evaluador_id    INTEGER NOT NULL REFERENCES "user"(id),
    notas_generales TEXT,
    creado_at       TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_evento_usuario_evaluador UNIQUE (evento_id, usuario_id, evaluador_id)
);

CREATE TABLE IF NOT EXISTS club_evento_evaluacion_detalle (
    id              SERIAL PRIMARY KEY,
    evaluacion_id   INTEGER NOT NULL REFERENCES club_evento_evaluacion(id) ON DELETE CASCADE,
    metrica_id      INTEGER NOT NULL REFERENCES club_metrica_evaluacion(id),
    calificacion    SMALLINT NOT NULL,

    CONSTRAINT uq_evaluacion_metrica UNIQUE (evaluacion_id, metrica_id),
    CONSTRAINT chk_calificacion_rango CHECK (calificacion BETWEEN 1 AND 10)
);

-- Prácticas internas a nivel división
ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS club_division_id INTEGER REFERENCES club_divisiones(id);

CREATE INDEX IF NOT EXISTS idx_partidos_club_division ON partidos (club_division_id);

COMMENT ON COLUMN notificaciones.tipo IS
  'Tipos: INVITACION_EQUIPO, SOLICITUD_CLUB, CLUB_ACEPTADA, CLUB_RECHAZADA, ANUNCIO_CLUB, ...';
