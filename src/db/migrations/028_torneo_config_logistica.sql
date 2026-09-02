-- Configuración de torneo: plantilla, logística y grupos+eliminatorias

ALTER TABLE torneos
  ADD COLUMN IF NOT EXISTS max_jugadores_equipo INTEGER,
  ADD COLUMN IF NOT EXISTS numero_canchas INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tipo_duracion VARCHAR(20) DEFAULT 'RELAMPAGO',
  ADD COLUMN IF NOT EXISTS fecha_fin DATE,
  ADD COLUMN IF NOT EXISTS hora_inicio_diaria TIME DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS hora_fin_diaria TIME DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS descanso_minimo_minutos INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS duracion_estimada_partido_minutos INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS numero_grupos INTEGER,
  ADD COLUMN IF NOT EXISTS clasificados_por_grupo INTEGER,
  ADD COLUMN IF NOT EXISTS metodo_distribucion VARCHAR(20),
  ADD COLUMN IF NOT EXISTS requiere_partido_grupos_para_eliminatoria BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE torneos
  DROP CONSTRAINT IF EXISTS chk_torneo_tipo_duracion;
ALTER TABLE torneos
  ADD CONSTRAINT chk_torneo_tipo_duracion
  CHECK (tipo_duracion IS NULL OR tipo_duracion IN ('RELAMPAGO', 'MULTIPLE_DIAS'));

ALTER TABLE torneos
  DROP CONSTRAINT IF EXISTS chk_torneo_metodo_distribucion;
ALTER TABLE torneos
  ADD CONSTRAINT chk_torneo_metodo_distribucion
  CHECK (metodo_distribucion IS NULL OR metodo_distribucion IN ('ALEATORIO', 'MANUAL'));

ALTER TABLE torneos
  DROP CONSTRAINT IF EXISTS chk_torneo_max_jugadores_equipo;
ALTER TABLE torneos
  ADD CONSTRAINT chk_torneo_max_jugadores_equipo
  CHECK (max_jugadores_equipo IS NULL OR max_jugadores_equipo >= 1);

ALTER TABLE torneos
  DROP CONSTRAINT IF EXISTS chk_torneo_numero_canchas;
ALTER TABLE torneos
  ADD CONSTRAINT chk_torneo_numero_canchas
  CHECK (numero_canchas >= 1);

-- Ampliar tipos de formato de fase
ALTER TABLE fases_torneo
  DROP CONSTRAINT IF EXISTS chk_tipo_formato;
ALTER TABLE fases_torneo
  ADD CONSTRAINT chk_tipo_formato
  CHECK (tipo_formato IN ('TODOS_CONTRA_TODOS', 'ELIMINACION_DIRECTA', 'GRUPOS_ELIMINATORIAS'));

COMMENT ON COLUMN torneos.max_jugadores_equipo IS 'Máximo de jugadores en nómina por equipo para este torneo';
COMMENT ON COLUMN torneos.requiere_partido_grupos_para_eliminatoria IS 'Si true, jugador debe tener stats en fase de grupos para jugar eliminatorias';
