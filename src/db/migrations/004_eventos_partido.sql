-- migrations/004_eventos_partido.sql

CREATE TABLE eventos_partido (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partido_id          INTEGER NOT NULL REFERENCES partidos(id),

    dispositivo_id      UUID NOT NULL,
    secuencia_local     INTEGER NOT NULL,

    tipo_evento         VARCHAR(30) NOT NULL,
    -- 'PUNTO', 'CAMBIO', 'SANCION', 'ROTACION', 'ANULACION_EVENTO', 'CAMBIO_SET'

    actor_principal_id   INTEGER REFERENCES "user"(id),
    actor_secundario_id  INTEGER REFERENCES "user"(id),

    detalle_json        JSONB NOT NULL DEFAULT '{}',
    -- Ejemplos:
    --   PUNTO:            {"equipo": "LOCAL"}
    --   CAMBIO:           {"saliente_id": 12, "entrante_id": 34}
    --   SANCION:          {"tarjeta": "AMARILLA"}
    --   ANULACION_EVENTO: {"evento_anulado_id": "<uuid>"}
    --   ROTACION:         {"nueva_formacion": [1,2,3,4,5,6]}

    ocurrido_en_cliente  TIMESTAMP NOT NULL,
    recibido_en_servidor TIMESTAMP NOT NULL DEFAULT NOW(),
    creado_en            TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_evento_id UNIQUE (id),
    CONSTRAINT uq_secuencia_dispositivo UNIQUE (partido_id, dispositivo_id, secuencia_local),
    CONSTRAINT chk_tipo_evento CHECK (
        tipo_evento IN ('PUNTO', 'CAMBIO', 'SANCION', 'ROTACION', 'ANULACION_EVENTO', 'CAMBIO_SET')
    )
);

CREATE INDEX idx_eventos_partido_orden
    ON eventos_partido (partido_id, dispositivo_id, secuencia_local);

CREATE INDEX idx_eventos_anulaciones
    ON eventos_partido ((detalle_json->>'evento_anulado_id'))
    WHERE tipo_evento = 'ANULACION_EVENTO';

-- Insertar SIEMPRE con ON CONFLICT (id) DO NOTHING desde la capa de aplicación,
-- para garantizar idempotencia ante reintentos de red del cliente offline.

-- marcadores_detalle: estado consolidado, es una vista derivada del log,
-- recalculada por el reducer — nunca editada a mano.

CREATE TABLE marcadores_detalle (
    id                      SERIAL PRIMARY KEY,
    partido_id              INTEGER NOT NULL UNIQUE REFERENCES partidos(id),

    resultado_principal     INTEGER NOT NULL DEFAULT 0,
    sets_ganados_local      SMALLINT NOT NULL DEFAULT 0,
    sets_ganados_visitante  SMALLINT NOT NULL DEFAULT 0,
    puntos_favor            INTEGER NOT NULL DEFAULT 0,
    puntos_contra           INTEGER NOT NULL DEFAULT 0,

    metrica_estructura      JSONB NOT NULL DEFAULT '{}',
    ultimo_evento_id        UUID REFERENCES eventos_partido(id),
    reglas_arbitraje_snapshot JSONB NOT NULL,

    actualizado_en          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Validación mínima de forma del snapshot de reglas (el reducer depende de estas
-- llaves; sin ellas el cálculo del marcador puede fallar silenciosamente):
ALTER TABLE marcadores_detalle
ADD CONSTRAINT chk_reglas_arbitraje_shape CHECK (
    reglas_arbitraje_snapshot ? 'puntos_por_set'
    AND reglas_arbitraje_snapshot ? 'ventaja_obligatoria'
    AND reglas_arbitraje_snapshot ? 'sets_para_ganar'
);
