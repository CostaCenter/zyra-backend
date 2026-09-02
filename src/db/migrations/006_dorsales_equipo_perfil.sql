-- migrations/006_dorsales_equipo_perfil.sql
-- Dorsal habitual por miembro de equipo y dorsal preferido en perfil deportivo.

ALTER TABLE "Team_Miembros"
  ADD COLUMN dorsal_habitual SMALLINT;

ALTER TABLE "Team_Miembros"
  ADD CONSTRAINT uq_team_dorsal_habitual UNIQUE (team_id, dorsal_habitual);

ALTER TABLE usuario_stats_por_sport
  ADD COLUMN dorsal_preferido SMALLINT;
