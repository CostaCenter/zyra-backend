-- Índices únicos legacy (pre set_numero) que impiden nóminas distintas por set.
-- La migración 036 reemplazó las CONSTRAINTS pero estos INDEX quedaron huérfanos.

DROP INDEX IF EXISTS partido_nominas_partido_id_user_id;
DROP INDEX IF EXISTS partido_nominas_partido_id_team_id_dorsal;

-- Por si existían como constraints con otro nombre (instalaciones antiguas)
ALTER TABLE partido_nominas DROP CONSTRAINT IF EXISTS uq_partido_jugador;
ALTER TABLE partido_nominas DROP CONSTRAINT IF EXISTS uq_partido_team_dorsal;
