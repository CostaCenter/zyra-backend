-- Cuota de ingreso: un solo registro de pago por miembro y concepto

CREATE OR REPLACE FUNCTION enforce_cuota_ingreso_unica()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM club_conceptos_pago c
    WHERE c.id = NEW.concepto_pago_id AND c.tipo = 'CUOTA_INGRESO'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM club_pagos_miembro p
      WHERE p.concepto_pago_id = NEW.concepto_pago_id
        AND p.usuario_id = NEW.usuario_id
        AND p.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Cuota de ingreso ya registrada para este miembro';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cuota_ingreso_unica ON club_pagos_miembro;
CREATE TRIGGER trg_cuota_ingreso_unica
BEFORE INSERT OR UPDATE OF concepto_pago_id, usuario_id ON club_pagos_miembro
FOR EACH ROW EXECUTE PROCEDURE enforce_cuota_ingreso_unica();
