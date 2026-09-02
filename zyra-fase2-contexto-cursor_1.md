# Contexto Técnico — Zyra Fase 2 (Torneos, Eventos, Nóminas)

> Documento de referencia para Cursor (Composer 2.5). Contiene el diseño ya congelado
> tras análisis de arquitectura. **Implementar en el orden de las secciones.**
> Stack: Node.js + Express + Sequelize v6 + PostgreSQL. **JavaScript puro, NO TypeScript.**
> Convención: snake_case en tablas nuevas. Migraciones manuales (no hay Sequelize CLI).

---

## 0. Alcance de este documento (Franja 1 — Núcleo indispensable)

Este documento cubre **solo** el núcleo operativo: torneos, fixture, log de eventos,
nóminas y validadores de reglas deportivas. **NO incluye todavía** clubes, seguidores,
notificaciones, publicaciones/feed social ni verificación de identidad — esas son
Franja 2 y Franja 3, documentadas por separado y pausadas hasta que este núcleo esté
probado en cancha real.

Prioridad de implementación dentro de este documento:
1. Extensión de `partidos` (bajo riesgo, no rompe nada existente)
2. Jerarquía de torneo (`torneos`, `fases_torneo`, `grupos_divisiones`, `progresion_fixture`)
3. `partido_nominas` (bloquea suplantación de identidad — crítico para reglamento real)
4. `eventos_partido` (log inmutable)
5. Reducer puro en JS
6. Validadores de reglas de dominio (ej: cambios en vóley piso)

---

## 1. Contexto del esquema actual (NO TOCAR sin necesidad)

Tablas ya existentes y relevantes (ver `contexto-bd.md` del proyecto para el detalle completo):

- `user` — auth y perfil. PK `id`.
- `sports` — catálogo de deportes. **Vóley Piso y Vóley Playa deben ser dos filas
  separadas** (`sport_id` distinto), no un solo deporte con variante — sus ELO,
  reglas y número de jugadores son independientes.
- `complejos`, `canchas` — ya existen, no se tocan.
- `reservas` — ya existe. `partidos.reserva_id` pasa a ser **nullable** (ver sección 2).
- `Team`, `Team_Miembros`, `DataTeam` — ya existen, no se tocan en esta fase.
- `usuario_stats_por_sport` — **ya resuelve** el requisito de "perfil deportivo
  independiente por deporte" (ELO oficial/casual por `user_id` + `sport_id`). No
  requiere cambios; el job de recálculo de ELO post-partido debe leer/escribir aquí.
- `partidos` — existe, hoy atado 1:1 obligatorio a `reservas`. Se extiende, no se
  reemplaza.
- `partido_jugador_stats` — existe, hoy con columnas fútbol-específicas
  (goles/asistencias/amarillas/rojas). **No se modifica en esta fase.** A futuro se
  convertirá en tabla derivada del log de eventos (Franja 2), no ahora.

---

## 2. Migración 1 — Extender `partidos`

```sql
-- migrations/001_extender_partidos_torneo.sql

ALTER TABLE partidos
  ALTER COLUMN reserva_id DROP NOT NULL;

ALTER TABLE partidos
  ADD COLUMN torneo_id INTEGER REFERENCES torneos(id),
  ADD COLUMN fase_torneo_id INTEGER REFERENCES fases_torneo(id),
  ADD COLUMN grupo_division_id INTEGER REFERENCES grupos_divisiones(id),
  ADD COLUMN nivel_arbitraje VARCHAR(10) NOT NULL DEFAULT 'BASICO';

ALTER TABLE partidos
  ADD CONSTRAINT chk_nivel_arbitraje CHECK (nivel_arbitraje IN ('BASICO', 'AVANZADO'));

-- Nuevos estados de partido necesarios para el flujo de torneo
-- (agregar a la lógica de aplicación donde se valide `state`, no hay ENUM de Postgres):
-- 'PROGRAMADO'   -> fixture generado, aún sin jugar
-- 'EN_CURSO'     -> partido siendo arbitrado en este momento
-- 'WALKOVER'     -> un equipo no se presentó
-- (mantener los existentes: pendiente, finalizado, DISPUTA, etc.)
```

**Nota para Cursor:** esta migración depende de que las tablas `torneos`,
`fases_torneo`, `grupos_divisiones` existan primero (sección 3). Ejecutar en el
orden: sección 3 → luego esta migración con los FKs, o crear las columnas sin FK
primero y agregar los `REFERENCES` después. Preferir lo segundo si se ejecuta como
un solo script.

---

## 3. Migración 2 — Jerarquía de torneo

```sql
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
```

**Nota sobre `modalidad` en `torneos`:** es redundante con tener Vóley Piso y Vóley
Playa como `sport_id` separados (sección 1), pero se deja como campo descriptivo
opcional por si en el futuro se necesita distinguir sub-variantes dentro del mismo
`sport_id` (ej. "vóley mixto"). No es la fuente de verdad de la modalidad — el
`sport_id` sí lo es.

---

## 4. Migración 3 — `partido_nominas`

Resuelve el flujo: plantilla general del equipo → convocatoria de la fecha → doble
validación capitán/árbitro → solo titulares reciben eventos al inicio → suplentes se
activan vía evento `CAMBIO`.

```sql
-- migrations/003_partido_nominas.sql

CREATE TABLE partido_nominas (
    id                  SERIAL PRIMARY KEY,
    partido_id          INTEGER NOT NULL REFERENCES partidos(id),
    team_id             INTEGER NOT NULL REFERENCES "Team"(id),
    user_id             INTEGER NOT NULL REFERENCES "user"(id),

    dorsal              SMALLINT NOT NULL,
    rol_nomina          VARCHAR(10) NOT NULL, -- 'TITULAR' | 'SUPLENTE'

    propuesto_por_id    INTEGER NOT NULL REFERENCES "user"(id), -- capitán
    validado_por_id     INTEGER REFERENCES "user"(id),          -- árbitro
    estado_validacion   VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    validado_at         TIMESTAMP,

    creado_at           TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_rol_nomina CHECK (rol_nomina IN ('TITULAR', 'SUPLENTE')),
    CONSTRAINT chk_estado_validacion CHECK (estado_validacion IN ('PENDIENTE', 'VALIDADO', 'RECHAZADO')),
    CONSTRAINT uq_partido_jugador UNIQUE (partido_id, user_id),
    CONSTRAINT uq_partido_team_dorsal UNIQUE (partido_id, team_id, dorsal)
);

CREATE INDEX idx_nominas_partido ON partido_nominas (partido_id);
```

**Regla de negocio crítica (a nivel de aplicación, NO solo SQL):** antes de aceptar
cualquier evento en `eventos_partido` con `actor_principal_id` o
`actor_secundario_id`, el backend debe verificar que ese `user_id` tenga una fila en
`partido_nominas` para ese `partido_id` con `estado_validacion = 'VALIDADO'`. Si no
la tiene, el evento se rechaza (esto blinda contra suplantación de identidad —
requisito de negocio explícito).

**Estado inicial de "activo":** solo los `rol_nomina = 'TITULAR'` están habilitados
para recibir eventos al arrancar el partido. Un `SUPLENTE` se activa cuando entra un
evento `tipo_evento = 'CAMBIO'` que lo referencia como `actor_secundario_id`.

---

## 5. Migración 4 — `eventos_partido`

Log inmutable de event sourcing. **Nunca se hace UPDATE ni DELETE sobre esta tabla.**

```sql
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
```

```sql
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
```

**Regla de negocio:** `reglas_arbitraje_snapshot` se copia desde
`torneos.reglas_arbitraje_json` al momento de crear el `Partido`, y nunca se vuelve a
leer de `torneos` en vivo — si el torneo cambia sus reglas a mitad de camino, no debe
afectar retroactivamente partidos ya iniciados.

---

## 6. Reducer — JavaScript puro

Archivo sugerido: `src/services/reducerPartido.js`

```javascript
// ============================================================
// Paso 1 — Orden estricto y filtrado de eventos anulados
// ============================================================

function ordenarEventos(eventos) {
  return [...eventos].sort((a, b) => {
    if (a.dispositivo_id !== b.dispositivo_id) {
      return new Date(a.ocurrido_en_cliente) - new Date(b.ocurrido_en_cliente);
    }
    return a.secuencia_local - b.secuencia_local;
  });
}

function filtrarEventosValidos(eventosOrdenados) {
  const anulados = new Set();
  const idsDeAnulacion = new Set();

  for (const evento of eventosOrdenados) {
    if (evento.tipo_evento === 'ANULACION_EVENTO') {
      const targetId = evento.detalle_json?.evento_anulado_id;
      // Anti-doble-anulación: si el target ya fue anulado, o es en sí misma
      // una ANULACION_EVENTO, se ignora esta anulación.
      if (targetId && !anulados.has(targetId) && !idsDeAnulacion.has(targetId)) {
        anulados.add(targetId);
      }
      idsDeAnulacion.add(evento.id);
    }
  }

  return eventosOrdenados.filter(
    (e) => !anulados.has(e.id) && e.tipo_evento !== 'ANULACION_EVENTO'
  );
}

// ============================================================
// Paso 2 — Sub-reducers aislados por dominio
// (cada uno ignora eventos que no le interesan; testeables por separado)
// ============================================================

function reducirMarcador(eventosValidos, reglas) {
  return eventosValidos
    .filter((e) => e.tipo_evento === 'PUNTO')
    .reduce((estado, evento) => aplicarPunto(estado, evento, reglas), estadoMarcadorInicial());
}

function reducirRotacion(eventosValidos, formacionInicial) {
  return eventosValidos
    .filter((e) => e.tipo_evento === 'ROTACION' || e.tipo_evento === 'PUNTO')
    .reduce(
      (estado, evento) => aplicarRotacion(estado, evento),
      { formacion_actual: formacionInicial, jugador_al_saque: formacionInicial[0] ?? null }
    );
}

function reducirSanciones(eventosValidos) {
  return eventosValidos
    .filter((e) => e.tipo_evento === 'SANCION')
    .reduce((estado, evento) => aplicarSancion(estado, evento), { tarjetas: [] });
}

// ============================================================
// Reducer principal — función pura, sin efectos secundarios
// (no dispara notificaciones ni nada externo; eso vive en un
// proceso que INVOCA a este reducer y reacciona a los cambios)
// ============================================================

function reducirEstadoPartido(eventos, reglas, formacionInicial, snapshotPrevio) {
  const eventosAProcesar = snapshotPrevio
    ? eventos.filter((e) => e.id !== snapshotPrevio.ultimo_evento_id_procesado)
    : eventos;

  const ordenados = ordenarEventos(eventosAProcesar);
  const validos = filtrarEventosValidos(ordenados);

  return {
    marcador: reducirMarcador(validos, reglas),
    rotacion: reducirRotacion(validos, formacionInicial),
    sanciones: reducirSanciones(validos),
    ultimo_evento_id_procesado:
      ordenados.at(-1)?.id ?? snapshotPrevio?.ultimo_evento_id_procesado ?? null,
  };
}

// Helpers de dominio — implementar según reglas de cada deporte.
// aplicarPunto: usa `reglas.puntos_por_set`, `reglas.ventaja_obligatoria`,
//   `reglas.sets_para_ganar` para decidir si un punto cierra el set.
function estadoMarcadorInicial() {
  return {
    resultado_principal: 0,
    sets_ganados_local: 0,
    sets_ganados_visitante: 0,
    puntos_favor: 0,
    puntos_contra: 0,
    metrica_estructura: {},
  };
}

function aplicarPunto(estado, evento, reglas) {
  // TODO: implementar lógica de puntos + cierre de set con ventaja obligatoria
  return estado;
}

function aplicarRotacion(estado, evento) {
  // TODO: implementar rotación en sentido horario
  return estado;
}

function aplicarSancion(estado, evento) {
  // TODO: implementar acumulación de tarjetas
  return estado;
}

module.exports = {
  ordenarEventos,
  filtrarEventosValidos,
  reducirMarcador,
  reducirRotacion,
  reducirSanciones,
  reducirEstadoPartido,
};
```

**Instrucción para Cursor:** implementar `aplicarPunto`, `aplicarRotacion`,
`aplicarSancion` en llamadas separadas, una función a la vez. No generar todo el
archivo de una sola vez. Cada función debe tener su propio test unitario antes de
pasar a la siguiente.

**Caso de prueba obligatorio antes de dar por cerrado `aplicarPunto`:** un set de
vóley con ventaja obligatoria de 2, con una `ANULACION_EVENTO` a mitad de set, debe
recalcular el marcador correctamente descartando el punto anulado.

---

## 7. Validador de reglas de dominio — Vóley Piso (sustituciones)

Archivo sugerido: `src/validadores/voley.js`

**Regla oficial FIVB de reingreso:** un jugador titular que sale (A→B) solo puede
reingresar en el lugar de quien lo sustituyó (B→A). Una vez que A vuelve a salir,
debe ser reemplazado por alguien distinto a B (A→C). La pareja (A,B) queda agotada
para el resto del set en cualquier sentido.

```javascript
function validarCambioVoleyPiso(eventosDelSetActual, salienteId, entranteId) {
  const cambiosPrevios = eventosDelSetActual.filter((e) => e.tipo_evento === 'CAMBIO');

  const parejasUsadas = new Set();
  for (const cambio of cambiosPrevios) {
    const par = [cambio.detalle_json.saliente_id, cambio.detalle_json.entrante_id]
      .sort()
      .join('-');
    parejasUsadas.add(par);
  }

  const parClave = [salienteId, entranteId].sort().join('-');

  if (parejasUsadas.has(parClave)) {
    return { valido: false, motivo: 'Esta pareja de jugadores ya agotó su cambio permitido en este set' };
  }

  return { valido: true };
}

module.exports = { validarCambioVoleyPiso };
```

**Dónde se invoca:** en el endpoint que registra un evento `CAMBIO`, ANTES de
insertarlo en `eventos_partido`. El reducer nunca ve cambios inválidos — asume que
todo lo que recibe ya pasó validación.

```
Árbitro presiona "Cambio A→C"
  → Backend: validar nómina (partido_nominas, estado VALIDADO)
  → Backend: validarCambioVoleyPiso(eventos_del_set_actual, A, C)
  → Si inválido: rechazar con mensaje claro
  → Si válido: INSERT en eventos_partido (ON CONFLICT DO NOTHING)
  → El reducer consume el evento ya validado
```

**Nota:** "eventos del set actual" debe filtrarse desde el último evento
`CAMBIO_SET` (o el inicio del partido si es el set 1) — las parejas usadas en un set
no restringen el siguiente set.

**Diferencia por modalidad:** en vóley playa (`sport_id` distinto, sin
sustituciones), este validador ni se invoca — la configuración del torneo
(`reglas_arbitraje_json.sustituciones_habilitadas = false`) hace que la UI ni
muestre el botón de cambio.

---

## 8. Orden de ejecución sugerido para Cursor

1. Ejecutar migración 002 (jerarquía de torneo) — sin FKs hacia `partidos` todavía.
2. Ejecutar migración 001 (extender `partidos`) — ahora las FKs a `torneos`/`fases_torneo`/`grupos_divisiones` sí existen.
3. Ejecutar migración 003 (`partido_nominas`).
4. Ejecutar migración 004 (`eventos_partido` + `marcadores_detalle`).
5. Crear modelos Sequelize correspondientes a cada tabla nueva, con las
   `validate.isIn` equivalentes a los `CHECK` constraints de SQL.
6. Implementar `src/services/reducerPartido.js` función por función, con tests.
7. Implementar `src/validadores/voley.js`.
8. Endpoint de registro de evento: valida nómina → valida regla de dominio si aplica → inserta evento → invoca reducer → actualiza `marcadores_detalle`.

**No avanzar al siguiente paso sin confirmar que el anterior funciona.** Dado el
límite de créditos disponibles (Composer 2.5 Fast), cada paso debe ser un prompt
separado y acotado, no un solo prompt pidiendo "todo el módulo de torneos".

---

## 9. Fuera de alcance de este documento (para referencia futura)

- **Franja 2:** `clubes`, `usuario_sigue_usuario`, `usuario_sigue_team`,
  `usuario_sigue_club`, bloqueo de seguidores, sistema de notificaciones
  (calendario + basadas en eventos del reducer).
- **Franja 3:** `publicaciones`, `publicacion_media`, `publicacion_etiquetas`
  (polimórfico USER/TEAM/CLUB, con aprobación obligatoria de la entidad
  etiquetada), verificación de identidad (cédula + selfie, con manejo especial
  para menores de edad).

Estas se documentarán en un archivo separado cuando el núcleo de esta Fase 2 esté
probado en un torneo real.
