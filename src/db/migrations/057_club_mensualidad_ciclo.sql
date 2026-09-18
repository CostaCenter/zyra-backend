-- Ciclo individual de mensualidades por miembro

ALTER TABLE club_conceptos_pago
    ADD COLUMN IF NOT EXISTS dias_gracia SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS periodicidad_dias SMALLINT NOT NULL DEFAULT 30;

COMMENT ON COLUMN club_conceptos_pago.dias_gracia IS 'Solo MENSUALIDAD: días tras fecha_ingreso antes del primer cobro';
COMMENT ON COLUMN club_conceptos_pago.periodicidad_dias IS 'Solo MENSUALIDAD: días entre cortes sucesivos del mismo miembro';
