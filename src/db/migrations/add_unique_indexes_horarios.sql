-- ============================================
-- MIGRACIÓN: Agregar índices únicos para horarios y precios
-- Archivo: migrations/add_unique_indexes_horarios.sql
-- ============================================

-- Índice único para complejo_horarios
-- Evita duplicados de horarios para el mismo día y complejo
-- Permite usar updateOnDuplicate en bulkCreate
ALTER TABLE complejo_horarios 
ADD CONSTRAINT uk_complejo_horarios_complejo_dia 
UNIQUE (complejo_id, dia_semana);

-- Índice único para cancha_horarios_precios
-- Evita duplicados de precios para el mismo día y hora de inicio
-- Permite usar updateOnDuplicate en bulkCreate
ALTER TABLE cancha_horarios_precios 
ADD CONSTRAINT uk_cancha_horarios_precios_cancha_dia_hora 
UNIQUE (cancha_id, tipo_dia, hora_inicio);

-- Índice para mejorar búsquedas por cancha y día
CREATE INDEX idx_cancha_horarios_precios_cancha_dia 
ON cancha_horarios_precios(cancha_id, tipo_dia);

-- Índice para mejorar búsquedas por complejo
CREATE INDEX idx_complejo_horarios_complejo 
ON complejo_horarios(complejo_id);
