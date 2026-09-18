-- Pagos informativos y uniformes de club (sin procesamiento de transacciones)

CREATE TABLE IF NOT EXISTS club_conceptos_pago (
    id                  SERIAL PRIMARY KEY,
    club_id             INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    tipo                VARCHAR(32) NOT NULL,
    nombre_personalizado VARCHAR(128),
    monto               NUMERIC(12, 2) NOT NULL DEFAULT 0,
    dias_aviso_previo   SMALLINT NOT NULL DEFAULT 5,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_club_concepto_tipo CHECK (tipo IN ('MENSUALIDAD', 'UNIFORME', 'CUOTA_INGRESO'))
);

CREATE INDEX IF NOT EXISTS idx_club_conceptos_pago_club ON club_conceptos_pago (club_id);

CREATE TABLE IF NOT EXISTS club_pagos_miembro (
    id                  SERIAL PRIMARY KEY,
    concepto_pago_id    INTEGER NOT NULL REFERENCES club_conceptos_pago(id) ON DELETE CASCADE,
    usuario_id          INTEGER NOT NULL REFERENCES "user"(id),
    fecha_corte         DATE NOT NULL,
    fecha_pago_real     TIMESTAMP,
    estado              VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE',
    registrado_por_id   INTEGER REFERENCES "user"(id),
    aviso_enviado_at    TIMESTAMP,
    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_club_pago_miembro UNIQUE (concepto_pago_id, usuario_id, fecha_corte),
    CONSTRAINT chk_club_pago_estado CHECK (estado IN ('PENDIENTE', 'PAGADO', 'VENCIDO', 'CORTESIA'))
);

CREATE INDEX IF NOT EXISTS idx_club_pagos_miembro_usuario ON club_pagos_miembro (usuario_id);
CREATE INDEX IF NOT EXISTS idx_club_pagos_miembro_estado ON club_pagos_miembro (estado);
CREATE INDEX IF NOT EXISTS idx_club_pagos_miembro_fecha_corte ON club_pagos_miembro (fecha_corte);

CREATE TABLE IF NOT EXISTS club_uniforme_asignaciones (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INTEGER NOT NULL REFERENCES "user"(id),
    club_division_id    INTEGER NOT NULL REFERENCES club_divisiones(id) ON DELETE CASCADE,
    talla               VARCHAR(16) NOT NULL,
    fecha_entrega       DATE,
    concepto_pago_id    INTEGER REFERENCES club_conceptos_pago(id) ON DELETE SET NULL,
    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_club_uniforme_usuario_division UNIQUE (usuario_id, club_division_id)
);

CREATE INDEX IF NOT EXISTS idx_club_uniforme_division ON club_uniforme_asignaciones (club_division_id);
