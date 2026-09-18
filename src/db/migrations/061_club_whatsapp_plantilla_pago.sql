-- Plantilla configurable para recordatorios de pago por WhatsApp
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS whatsapp_plantilla_pago TEXT;
