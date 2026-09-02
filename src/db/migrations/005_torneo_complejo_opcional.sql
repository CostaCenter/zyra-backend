-- migrations/005_torneo_complejo_opcional.sql
-- Los torneos no dependen estructuralmente de un complejo Zyra.

ALTER TABLE torneos
  ALTER COLUMN complejo_id DROP NOT NULL;
