-- Migración: campos de invitación de miembros en usuario_complejo

ALTER TABLE usuario_complejo
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE usuario_complejo
  ADD COLUMN IF NOT EXISTS nombre_invitacion VARCHAR(255),
  ADD COLUMN IF NOT EXISTS correo_invitacion VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rol_base VARCHAR(20) DEFAULT 'RECEPCIONISTA',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDIENTE',
  ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '{}'::jsonb;

-- Backfill de correo para registros existentes vinculados a un usuario
UPDATE usuario_complejo uc
SET correo_invitacion = LOWER(u.email)
FROM "user" u
WHERE uc.user_id = u.id
  AND uc.correo_invitacion IS NULL
  AND u.email IS NOT NULL;

UPDATE usuario_complejo
SET status = 'ACEPTADO'
WHERE status IS NULL
  AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_complejo_correo_complejo
  ON usuario_complejo (LOWER(correo_invitacion), complejo_id)
  WHERE correo_invitacion IS NOT NULL
    AND status IN ('PENDIENTE', 'ACEPTADO');

COMMENT ON COLUMN usuario_complejo.nombre_invitacion IS 'Nombre del invitado al momento de enviar la invitación';
COMMENT ON COLUMN usuario_complejo.correo_invitacion IS 'Correo al que se envió la invitación';
COMMENT ON COLUMN usuario_complejo.rol_base IS 'ADMINISTRADOR, RECEPCIONISTA o PERSONALIZADO';
COMMENT ON COLUMN usuario_complejo.status IS 'PENDIENTE, ACEPTADO o SUSPENDIDO';
COMMENT ON COLUMN usuario_complejo.permisos IS 'Permisos booleanos por módulo en formato JSONB';
