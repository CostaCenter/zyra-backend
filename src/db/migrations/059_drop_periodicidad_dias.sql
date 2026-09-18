-- Mensualidades: ciclo por mismo día del mes (fecha_ingreso + gracia), no intervalo fijo en días.
ALTER TABLE club_conceptos_pago
    DROP COLUMN IF EXISTS periodicidad_dias;
