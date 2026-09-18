-- Métricas ampliadas de evaluación en entrenamientos de vóley

ALTER TABLE club_metrica_evaluacion DROP CONSTRAINT IF EXISTS chk_metrica_categoria;
ALTER TABLE club_metrica_evaluacion
  ADD CONSTRAINT chk_metrica_categoria
  CHECK (categoria IN ('TECNICO', 'FISICO', 'ACTITUDINAL', 'TACTICO'));

INSERT INTO club_metrica_evaluacion (sport_id, nombre_metrica, categoria)
SELECT 2, m.nombre, m.categoria
FROM (VALUES
    ('Precisión en recepción de saque', 'TECNICO'),
    ('Consistencia en el saque', 'TECNICO'),
    ('Calidad y limpieza en la colocación', 'TECNICO'),
    ('Control y dirección del remate', 'TECNICO'),
    ('Efectividad en defensa de campo', 'TECNICO'),
    ('Postura y lectura previa', 'TACTICO'),
    ('Velocidad de transición', 'TACTICO'),
    ('Cobertura a los compañeros', 'TACTICO'),
    ('Comunicación en cancha', 'ACTITUDINAL'),
    ('Actitud defensiva / Esfuerzo en balones divididos', 'ACTITUDINAL')
) AS m(nombre, categoria)
WHERE EXISTS (SELECT 1 FROM sports WHERE id = 2)
ON CONFLICT (sport_id, nombre_metrica) DO NOTHING;
