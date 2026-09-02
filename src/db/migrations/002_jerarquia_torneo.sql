-- migrations/002_jerarquia_torneo.sql

CREATE TABLE torneos (
    id                      SERIAL PRIMARY KEY,
    complejo_id             INTEGER NOT NULL REFERENCES complejos(id),
    sport_id                INTEGER NOT NULL REFERENCES sports(id),
    nombre                  VARCHAR(255) NOT NULL,

    creado_por_user_id      INTEGER NOT NULL REFERENCES "user"(id),
    club_organizador_id     INTEGER, -- FK a clubes(id) se agrega en Franja 2; nullable desde ya

    nivel_arbitraje_default VARCHAR(10) NOT NULL DEFAULT 'BASICO',
    reglas_arbitraje_json   JSONB NOT NULL DEFAULT '{}',
    modalidad               VARCHAR(20), -- 'piso' | 'playa' | null (deportes sin modalidad)
    estado                  VARCHAR(20) NOT NULL DEFAULT 'PLANEACION',

    creado_at               TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_nivel_arbitraje_default CHECK (nivel_arbitraje_default IN ('BASICO', 'AVANZADO')),
    CONSTRAINT chk_estado_torneo CHECK (estado IN ('PLANEACION', 'INSCRIPCIONES', 'EN_CURSO', 'FINALIZADO', 'CANCELADO'))
);

CREATE TABLE fases_torneo (
    id              SERIAL PRIMARY KEY,
    torneo_id       INTEGER NOT NULL REFERENCES torneos(id),
    orden           INTEGER NOT NULL,
    tipo_formato    VARCHAR(30) NOT NULL, -- 'TODOS_CONTRA_TODOS' | 'ELIMINACION_DIRECTA'
    nombre          VARCHAR(100),

    CONSTRAINT chk_tipo_formato CHECK (tipo_formato IN ('TODOS_CONTRA_TODOS', 'ELIMINACION_DIRECTA')),
    CONSTRAINT uq_torneo_orden_fase UNIQUE (torneo_id, orden)
);

CREATE TABLE grupos_divisiones (
    id              SERIAL PRIMARY KEY,
    fase_torneo_id  INTEGER NOT NULL REFERENCES fases_torneo(id),
    nombre          VARCHAR(50) NOT NULL -- 'Grupo A', 'Liga Única'
);

CREATE TABLE progresion_fixture (
    id                  SERIAL PRIMARY KEY,
    torneo_id           INTEGER NOT NULL REFERENCES torneos(id),

    partido_origen_id   INTEGER NOT NULL REFERENCES partidos(id),
    partido_destino_id  INTEGER NOT NULL REFERENCES partidos(id),

    condicion_avance    VARCHAR(10) NOT NULL, -- 'GANADOR' | 'PERDEDOR'
    posicion_destino    VARCHAR(10) NOT NULL, -- 'LOCAL' | 'VISITANTE'

    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_condicion_avance CHECK (condicion_avance IN ('GANADOR', 'PERDEDOR')),
    CONSTRAINT chk_posicion_destino CHECK (posicion_destino IN ('LOCAL', 'VISITANTE')),
    CONSTRAINT uq_origen_destino_posicion UNIQUE (partido_origen_id, partido_destino_id, posicion_destino)
);

CREATE INDEX idx_progresion_origen ON progresion_fixture (partido_origen_id);
CREATE INDEX idx_progresion_destino ON progresion_fixture (partido_destino_id);
