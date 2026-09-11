-- Categoría de edad y género opcionales para equipos
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS categoria_edad VARCHAR(64);
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS genero VARCHAR(16);
