-- Configuración de puntos por tipo de acción, agnóstica al deporte (sport_id + tipo_accion).

CREATE TABLE IF NOT EXISTS valores_puntos_accion (
    id               SERIAL PRIMARY KEY,
    sport_id         INTEGER NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
    tipo_accion      VARCHAR(60) NOT NULL,
    puntos_otorgados INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_valores_puntos_sport_accion UNIQUE (sport_id, tipo_accion),
    CONSTRAINT chk_puntos_otorgados_nonneg CHECK (puntos_otorgados >= 0)
);

CREATE INDEX IF NOT EXISTS idx_valores_puntos_accion_sport
    ON valores_puntos_accion (sport_id);

COMMENT ON TABLE valores_puntos_accion IS
    'Puntos de desempeño personal por acción y deporte; agregar filas para nuevos deportes sin cambiar código.';
COMMENT ON COLUMN valores_puntos_accion.tipo_accion IS
    'Clave de acción (ej. ATAQUE, GOL); debe coincidir con detalle_json.tipo_accion del evento.';

-- Valores iniciales vóley (sport cuyo nombre contiene vole/volley)
INSERT INTO valores_puntos_accion (sport_id, tipo_accion, puntos_otorgados)
SELECT s.id, v.tipo_accion, v.puntos
FROM sports s
CROSS JOIN (
    VALUES
        ('ATAQUE', 2),
        ('BLOQUEO', 3),
        ('SAQUE_DIRECTO', 4),
        ('PUNTO_ERROR_RIVAL', 1)
) AS v(tipo_accion, puntos)
WHERE (LOWER(s.name) LIKE '%vole%'
   OR LOWER(s.name) LIKE '%volley%')
  AND NOT EXISTS (
    SELECT 1
    FROM valores_puntos_accion vpa
    WHERE vpa.sport_id = s.id
      AND vpa.tipo_accion = v.tipo_accion
  );

-- partido_jugador_stats: puntos de desempeño del partido
ALTER TABLE partido_jugador_stats
    ADD COLUMN IF NOT EXISTS puntos_personales INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN partido_jugador_stats.puntos_personales IS
    'Suma de puntos de desempeño según valores_puntos_accion al finalizar el partido.';

-- DataTeam: fuerza del roster (promedio ajustado de puntos personales por partido)
ALTER TABLE "DataTeam"
    ADD COLUMN IF NOT EXISTS fuerza_equipo DECIMAL(10, 2);

COMMENT ON COLUMN "DataTeam".fuerza_equipo IS
    'Promedio de puntos personales por partido del roster (mín. 3 partidos para valor pleno).';
