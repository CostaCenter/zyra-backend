-- Migración: Crear tabla configuracion_horarios_favoritos
-- Descripción: Tabla para almacenar plantillas de configuración de horarios y precios favoritos

CREATE TABLE IF NOT EXISTS configuracion_horarios_favoritos (
  id SERIAL PRIMARY KEY,
  complejo_id INTEGER NOT NULL REFERENCES complejos(id) ON DELETE CASCADE,
  cancha_id INTEGER NOT NULL REFERENCES canchas(id) ON DELETE CASCADE,
  nombre_plantilla VARCHAR(255) NOT NULL,
  configuracion JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para búsquedas rápidas por complejo
CREATE INDEX idx_configuracion_horarios_favoritos_complejo_id 
ON configuracion_horarios_favoritos(complejo_id);

CREATE UNIQUE INDEX idx_configuracion_horarios_favoritos_cancha_id
ON configuracion_horarios_favoritos(cancha_id);

-- Comentarios en la tabla
COMMENT ON TABLE configuracion_horarios_favoritos IS 'Plantillas guardadas de configuración de horarios y precios para canchas';
COMMENT ON COLUMN configuracion_horarios_favoritos.nombre_plantilla IS 'Nombre descriptivo de la plantilla, ej: "Precios Verano", "Horario Especial Navidad"';
COMMENT ON COLUMN configuracion_horarios_favoritos.configuracion IS 'JSON estructurado con bloques de horarios y precios {bloques: [{dias, horaInicio, horaFin, precio}]}';
