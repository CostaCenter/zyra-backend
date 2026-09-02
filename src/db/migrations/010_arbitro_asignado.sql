-- migrations/010_arbitro_asignado.sql

ALTER TABLE partidos
  ADD COLUMN arbitro_asignado_id INTEGER REFERENCES "user"(id);
