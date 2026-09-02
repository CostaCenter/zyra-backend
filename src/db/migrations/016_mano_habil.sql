-- Campo mano_habil para vóley (independiente de pierna_habil en fútbol)
ALTER TABLE usuario_stats_por_sport
  ADD COLUMN IF NOT EXISTS mano_habil VARCHAR(20) NULL;

COMMENT ON COLUMN usuario_stats_por_sport.mano_habil IS 'DERECHA, IZQUIERDA, AMBIDIESTRO — vóley';
