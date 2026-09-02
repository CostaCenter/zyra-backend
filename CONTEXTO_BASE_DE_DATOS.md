# Contexto de Base de Datos — Proyecto Zyra

> Documento de referencia para que una IA (o desarrollador) entienda el esquema, relaciones y lógica de negocio de la base de datos de Zyra.
>
> **Última revisión:** julio 2026  
> **Backend:** `backend-zyra`  
> **Frontend:** `appZyra` (no tiene DB propia; consume la API REST del backend)

---

## 1. Stack y configuración

| Aspecto | Detalle |
|---------|---------|
| Motor | **PostgreSQL** |
| ORM | **Sequelize v6** |
| Driver | `pg` |
| Sincronización | `sequelize.sync({ force: false })` al arrancar el servidor (`src/app.js`) |
| Migraciones | Manuales (SQL + scripts JS). **No hay Sequelize CLI ni tabla `SequelizeMeta`** |

### Variables de entorno (`.env`)

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zyra
DB_USER=postgres
DB_PASSWORD=...
```

### Archivos clave

| Ruta | Propósito |
|------|-----------|
| `src/config/database.js` | Conexión Sequelize |
| `src/db/db.js` | Registro de modelos + **todas las relaciones (associations)** |
| `src/db/models/*.js` | Definición de cada tabla (21 modelos) |
| `src/db/migrations/*.sql` | Migraciones SQL manuales |
| `src/migrations/*.js` | Migraciones JS manuales |
| `src/db/docs/schema.dbml` | Diagrama DBML (**parcialmente desactualizado**) |
| `src/constants/miembroPermisos.js` | Esquema JSONB de permisos de staff |

---

## 2. Dominios del negocio

La base de datos soporta una plataforma de **reserva de canchas deportivas** con estos módulos:

1. **Usuarios y autenticación** — jugadores, dueños, admins; login por email, teléfono o Google.
2. **Complejos deportivos** — instalaciones con canchas, horarios y staff.
3. **Canchas** — detalles físicos, galería, precios dinámicos y estado operativo.
4. **Reservas** — núcleo del negocio; pagos por abono, movimientos, cancelaciones.
5. **Precios y horarios** — motor híbrido por día de semana, franjas horarias y festivos.
6. **Control de acceso (RBAC)** — staff de complejos con permisos granulares vía JSONB.
7. **Equipos y partidos** — stats, confirmación de marcadores, ELO por deporte.

---

## 3. Diagrama de relaciones (simplificado)

```
user ──────────────────────────────────────────────────────────────┐
  │                                                                 │
  ├──< complejos (dueño_id)                                         │
  ├──<> complejos  [via usuario_complejo]  (M:N staff/acceso)      │
  ├──< reservas                                                     │
  ├──< usuario_stats_por_sport                                      │
  ├──< Team (capitan_id)                                            │
  ├──< Team_Miembros                                                │
  ├──< partidos (started_by_id)                                     │
  ├──< partido_confirmaciones                                       │
  └──< partido_jugador_stats                                        │
                                                                    │
complejos ──< canchas ──< reservas ──< partidos (1:1)              │
  │              │                                                  │
  ├──< complejo_horarios                                           │
  ├──< calendario_excepciones                                      │
  ├──< configuracion_horarios_favoritos                            │
  └──< usuario_complejo                                            │
                                                                    │
canchas ──< cancha_horarios_precios                                │
       ──< WallpaperCanchas                                        │
       ──1 detailsCanchas                                          │
       ──1 configuracion_horarios_favoritos                        │
                                                                    │
sports ──< canchas, Team, usuario_stats_por_sport, partidos        │
                                                                    │
Team ──1 DataTeam                                                  │
     ──< Team_Miembros                                             │
     ──< Partido_Participantes                                     │
```

---

## 4. Catálogo de tablas (21 activas)

> **Convención de nombres mixta:** snake_case (`complejo_horarios`), PascalCase (`Team`, `DataTeam`, `Partido_Participantes`, `WallpaperCanchas`), camelCase (`detailsCanchas`). PostgreSQL distingue mayúsculas en identificadores entre comillas.

---

### 4.1 `user` — Usuarios principales (ACTIVA)

Tabla central de autenticación y perfiles. **Es la tabla que usa toda la app.**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | INTEGER | PK, autoIncrement | |
| `name` | STRING | nullable | Nombre completo |
| `nick` | STRING | UNIQUE, nullable | Apodo |
| `photo` | TEXT | nullable | URL/foto |
| `email` | STRING | UNIQUE, nullable | Login email / Google |
| `telefono` | STRING | UNIQUE, nullable | Login por teléfono |
| `password_hash` | STRING | nullable | Solo auth tradicional |
| `google_id` | STRING | UNIQUE, nullable | ID Google (sub) |
| `role` | STRING | nullable | `JUGADOR`, `DUEÑO`, `ADMIN` |
| `status` | STRING | default `ACTIVO` | `ACTIVO`, `BANEADO`, `POR_VERIFICAR` |
| `creado_at` | DATE | default NOW | |
| `last_login` | DATE | nullable | |

---

### 4.2 `usuarios` — Legacy (PROBABLEMENTE OBSOLETA)

Exportada en `db.js` pero **no usada** en servicios ni controladores. La app usa `user`.

| Campo | Tipo |
|-------|------|
| `id` | INTEGER PK |
| `nombre` | STRING |
| `telefono` | STRING |
| `email` | STRING |
| `creado_at` | DATE |

---

### 4.3 `complejos` — Complejos deportivos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `nombre` | STRING | |
| `ubicacion` | STRING | Ej: Jamundí, Cali |
| `dueño_id` | INTEGER FK → `user.id` | Dueño (legacy, se mantiene por compatibilidad) |
| `photo` | TEXT | |
| `wallpaper` | TEXT | |

**Relaciones:** canchas, horarios, excepciones, configs favoritas, accesos vía `usuario_complejo`.

---

### 4.4 `canchas` — Canchas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `complejo_id` | INTEGER FK → `complejos.id` | |
| `nombre` | STRING | "Cancha 1", "Sintética Pro" |
| `tipo_deporte` | STRING | Texto libre ("Voley", "Fútbol") |
| `sport_id` | INTEGER FK → `sports.id` | |
| `precio_hora` | DECIMAL(10,2) | Precio base / fallback |
| `state` | STRING | `DISPONIBLE`, `OCUPADA`, `MANTENIMIENTO`, `FUERA DE SERVICIO` |
| `photo` | TEXT | |

---

### 4.5 `detailsCanchas` — Detalles físicos (1:1 con cancha)

| Campo | Tipo |
|-------|------|
| `id` | INTEGER PK |
| `tipoSuperfice` | STRING |
| `tipoDeCancha` | STRING |
| `capacidadMaxima` | INTEGER |
| `techado` | BOOLEAN |
| `iluminacion` | BOOLEAN |
| `dimensiones` | STRING |
| `ubicacionInterna` | STRING |
| `cancha_id` | INTEGER FK → `canchas.id` |

---

### 4.6 `WallpaperCanchas` — Galería de imágenes (1:N)

| Campo | Tipo |
|-------|------|
| `id` | INTEGER PK |
| `img_url` | TEXT |
| `description` | TEXT |
| `state` | BOOLEAN |
| `cancha_id` | INTEGER FK → `canchas.id` |

---

### 4.7 `sports` — Catálogo de deportes

| Campo | Tipo |
|-------|------|
| `id` | INTEGER PK |
| `name` | STRING |
| `state` | STRING |

---

### 4.8 `complejo_horarios` — Horario de apertura/cierre

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `complejo_id` | INTEGER FK | |
| `dia_semana` | INTEGER | 0=Dom, 1=Lun, …, 6=Sáb |
| `hora_apertura` | TIME | |
| `hora_cierre` | TIME | |
| `esta_cerrado` | BOOLEAN | default false |

**Índice UNIQUE:** `(complejo_id, dia_semana)`

---

### 4.9 `cancha_horarios_precios` — Precios dinámicos por día/hora

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `cancha_id` | INTEGER FK | |
| `tipo_dia` | INTEGER | 0–6 = Dom–Sáb, **7 = FESTIVO** |
| `hora_inicio` | TIME | Ej: 08:00 |
| `hora_fin` | TIME | Ej: 14:00 |
| `precio_hora` | DECIMAL(10,2) | Ej: 60000 |

**Índice UNIQUE:** `(cancha_id, tipo_dia, hora_inicio)`

---

### 4.10 `calendario_excepciones` — Fechas especiales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `complejo_id` | INTEGER FK | |
| `fecha` | DATEONLY | UNIQUE global (ver nota abajo) |
| `esta_abierto` | BOOLEAN | false = cierre total |
| `es_festivo` | BOOLEAN | Si true → aplica `tipo_dia: 7` en precios |
| `descripcion` | STRING | "Lunes de Ascensión" |

> **Nota:** `fecha` es UNIQUE a nivel global, no por `complejo_id`. Dos complejos no pueden tener excepciones el mismo día según el constraint actual.

---

### 4.11 `configuracion_horarios_favoritos` — Plantillas de precios guardadas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `complejo_id` | INTEGER FK CASCADE | |
| `cancha_id` | INTEGER FK CASCADE, **UNIQUE** | Una plantilla por cancha |
| `nombre_plantilla` | VARCHAR(255) | "Precios Verano" |
| `configuracion` | **JSONB** | `{ bloques: [{ dias, horaInicio, horaFin, precio }] }` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### 4.12 `reservas` — Núcleo del negocio

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `id` | INTEGER PK | | |
| `user_id` | INTEGER FK | nullable | → `user.id` (null en reservas manuales) |
| `cancha_id` | INTEGER FK | | → `canchas.id` |
| `fecha` | DATEONLY | NOT NULL | |
| `hora_inicio` | TIME | NOT NULL | |
| `duracion_minutos` | INTEGER | 60 | Bloques 60/90/120 min |
| `monto_total` | DECIMAL(10,2) | NOT NULL | Precio calculado |
| `monto_abono` | DECIMAL(10,2) | 0 | ~30% para apartar |
| `metodo_pago` | STRING | | `NEQUI`, `EFECTIVO`, `PAGOS_APP` |
| `estado_pago` | STRING | `ABONADA` | `ABONADA`, `PAGADA_TOTAL`, `CANCELADA` |
| `estado_reserva` | STRING | `CONFIRMADA` | `CONFIRMADA`, `FINALIZADA`, `NO_SHOW`, `CANCELADA` |
| `fecha_original` | DATEONLY | | Antes de mover (dueño) |
| `hora_inicio_original` | TIME | | |
| `motivo_movimiento` | TEXT | | |
| `movida_por_id` | INTEGER | | user_id del dueño |
| `movida_at` | TIMESTAMP | | |
| `cancelada_por_id` | INTEGER | | |
| `cancelada_at` | TIMESTAMP | | |
| `origen_reserva` | STRING(20) | `WEB` | `MANUAL`, `WEB`, `APP`, `API` |
| `telefono_contacto` | STRING(20) | | Reservas sin user_id |
| `nombre_contacto` | STRING(100) | | |
| `creado_at` | DATE | NOW | |
| `updated_at` | DATE | | |

**Lógica financiera:** no hay tablas de transacciones/caja. Los ingresos se calculan desde `reservas`:
- `PAGADA_TOTAL` → cuenta `monto_total`
- `ABONADA` → cuenta `monto_abono`
- Filtros típicos: `estado_reserva NOT IN ('CANCELADA')` y `estado_pago IN ('ABONADA', 'PAGADA_TOTAL')`

---

### 4.13 `usuario_complejo` — Staff y acceso a complejos (M:N)

Tabla intermedia entre `user` y `complejos` con RBAC granular.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `user_id` | INTEGER FK | nullable hasta aceptar invitación |
| `complejo_id` | INTEGER FK CASCADE | |
| `rol_en_complejo` | STRING | `DUEÑO`, `ADMIN`, `ACCESO`, `EMPLEADO` |
| `nombre_invitacion` | STRING | |
| `correo_invitacion` | STRING | NOT NULL |
| `rol_base` | ENUM | `ADMINISTRADOR`, `RECEPCIONISTA`, `PERSONALIZADO` |
| `status` | ENUM | `PENDIENTE`, `ACEPTADO`, `SUSPENDIDO` |
| `permisos` | **JSONB** | Permisos por módulo (ver sección 6) |
| `creado_at` | TIMESTAMP | |

**Constraints relevantes:**
- UNIQUE `(user_id, complejo_id)` cuando `user_id IS NOT NULL`
- UNIQUE `(LOWER(correo_invitacion), complejo_id)` para status `PENDIENTE` o `ACEPTADO`

---

### 4.14 `usuario_stats_por_sport` — Stats de jugador por deporte

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `id` | INTEGER PK | | |
| `user_id` | INTEGER FK | | |
| `sport_id` | INTEGER FK | | |
| `elo_oficial` | DECIMAL(10,2) | 1.0 | Torneos/ligas |
| `goles_oficiales` | INTEGER | 0 | |
| `partidos_oficiales` | INTEGER | 0 | |
| `elo_casual` | DECIMAL(10,2) | 1.0 | Retos/amistosos |
| `goles_casuales` | INTEGER | 0 | |
| `partidos_casuales` | INTEGER | 0 | |
| `posicion_principal` | STRING | | PORTERO, DEFENSA, etc. |
| `pierna_habil` | STRING | | DERECHA, IZQUIERDA, AMBIDIESTRO |

> ELO oficial y casual son **independientes por deporte**.

---

### 4.15 `partidos` — Partidos vinculados a reservas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `name` | STRING | |
| `time` | INTEGER | Duración |
| `cancha_id` | INTEGER FK | |
| `sport_id` | INTEGER FK | |
| `reserva_id` | INTEGER FK | Relación 1:1 con reserva |
| `tipo` | STRING | `OFICIAL`, etc. |
| `state` | STRING | pendiente, finalizado, DISPUTA, etc. |
| `datetime` | DATE | |
| `started_by_id` | INTEGER FK → `user.id` | |
| `tipo_inicio` | STRING | `CAPITAN`, `DUEÑO`, `SISTEMA` |
| `score_local_final` | INTEGER | default 0 |
| `score_visitante_final` | INTEGER | default 0 |

---

### 4.16 `partido_confirmaciones` — Confirmación/impugnación de marcador

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `partido_id` | INTEGER FK | |
| `user_id` | INTEGER FK | Capitán que firma |
| `team_id` | INTEGER FK | |
| `rol_equipo` | STRING | `LOCAL`, `VISITANTE` |
| `score_local_propuesto` | INTEGER | |
| `score_visitante_propuesto` | INTEGER | |
| `es_impugnacion` | BOOLEAN | default false |
| `creado_at` | DATE | |

---

### 4.17 `Partido_Participantes` — Equipos en un partido

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `partido_id` | INTEGER FK | |
| `team_id` | INTEGER FK | |
| `es_local` | BOOLEAN | default true |
| `color_uniforme` | STRING | |
| `pago_completado` | BOOLEAN | default false |

---

### 4.18 `partido_jugador_stats` — Stats individuales por partido

| Campo | Tipo | Default |
|-------|------|---------|
| `id` | INTEGER PK | |
| `partido_id` | INTEGER FK | |
| `user_id` | INTEGER FK | |
| `team_id` | INTEGER FK | |
| `goles` | INTEGER | 0 |
| `asistencias` | INTEGER | 0 |
| `amarillas` | INTEGER | 0 |
| `rojas` | INTEGER | 0 |
| `jugo_minutos` | INTEGER | 60 |

---

### 4.19 `Team` — Equipos deportivos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `name` | STRING | |
| `url` | TEXT | |
| `logo_url` | TEXT | |
| `ciudad_base` | INTEGER | |
| `privado` | BOOLEAN | |
| `creado_at` | DATE | |
| `sport_id` | INTEGER FK | |
| `capitan_id` | INTEGER FK → `user.id` | |

---

### 4.20 `DataTeam` — Stats agregadas del equipo (1:1)

| Campo | Tipo |
|-------|------|
| `id` | INTEGER PK |
| `team_id` | INTEGER FK |
| `elo` | INTEGER |
| `games` | INTEGER |
| `win` | INTEGER |
| `lose` | INTEGER |
| `draw` | INTEGER |
| `total` | INTEGER |

---

### 4.21 `Team_Miembros` — Miembros de equipo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `team_id` | INTEGER FK | |
| `user_id` | INTEGER FK | |
| `position` | STRING | Posición en campo |
| `rol` | STRING | `CAPITAN`, `SUB_CAPITAN`, `JUGADOR` |
| `estado_invitacion` | STRING | `PENDIENTE`, `ACEPTADO`, `RECHAZADO` |
| `fecha_union` | DATE | |

---

## 5. Mapa de relaciones (foreign keys)

| Tabla origen | Campo | Tabla destino | Cardinalidad |
|--------------|-------|---------------|--------------|
| `complejos` | `dueño_id` | `user` | N:1 |
| `usuario_complejo` | `user_id` | `user` | N:1 |
| `usuario_complejo` | `complejo_id` | `complejos` | N:1 |
| `user` ↔ `complejos` | via `usuario_complejo` | — | **M:N** |
| `canchas` | `complejo_id` | `complejos` | N:1 |
| `canchas` | `sport_id` | `sports` | N:1 |
| `detailsCanchas` | `cancha_id` | `canchas` | 1:1 |
| `WallpaperCanchas` | `cancha_id` | `canchas` | N:1 |
| `complejo_horarios` | `complejo_id` | `complejos` | N:1 |
| `cancha_horarios_precios` | `cancha_id` | `canchas` | N:1 |
| `calendario_excepciones` | `complejo_id` | `complejos` | N:1 |
| `configuracion_horarios_favoritos` | `complejo_id` | `complejos` | N:1 |
| `configuracion_horarios_favoritos` | `cancha_id` | `canchas` | 1:1 |
| `reservas` | `user_id` | `user` | N:1 |
| `reservas` | `cancha_id` | `canchas` | N:1 |
| `partidos` | `reserva_id` | `reservas` | 1:1 |
| `partidos` | `started_by_id` | `user` | N:1 |
| `partidos` | `sport_id`, `cancha_id` | `sports`, `canchas` | N:1 |
| `usuario_stats_por_sport` | `user_id`, `sport_id` | `user`, `sports` | N:1 |
| `Team` | `capitan_id`, `sport_id` | `user`, `sports` | N:1 |
| `DataTeam` | `team_id` | `Team` | 1:1 |
| `Team_Miembros` | `user_id`, `team_id` | `user`, `Team` | N:1 |
| `partido_confirmaciones` | `partido_id`, `user_id`, `team_id` | `partidos`, `user`, `Team` | N:1 |
| `Partido_Participantes` | `partido_id`, `team_id` | `partidos`, `Team` | N:1 |
| `partido_jugador_stats` | `partido_id`, `user_id`, `team_id` | `partidos`, `user`, `Team` | N:1 |

---

## 6. Enums y valores de negocio

| Entidad.Campo | Valores |
|---------------|---------|
| `user.role` | `JUGADOR`, `DUEÑO`, `ADMIN` |
| `user.status` | `ACTIVO`, `BANEADO`, `POR_VERIFICAR` |
| `canchas.state` | `DISPONIBLE`, `OCUPADA`, `MANTENIMIENTO`, `FUERA DE SERVICIO` |
| `reservas.estado_pago` | `ABONADA`, `PAGADA_TOTAL`, `CANCELADA` |
| `reservas.estado_reserva` | `CONFIRMADA`, `FINALIZADA`, `NO_SHOW`, `CANCELADA` |
| `reservas.metodo_pago` | `NEQUI`, `EFECTIVO`, `PAGOS_APP` |
| `reservas.origen_reserva` | `MANUAL`, `WEB`, `APP`, `API` |
| `cancha_horarios_precios.tipo_dia` | 0–6 (días), 7 (festivo) |
| `usuario_complejo.rol_en_complejo` | `DUEÑO`, `ADMIN`, `ACCESO`, `EMPLEADO` |
| `usuario_complejo.rol_base` | `ADMINISTRADOR`, `RECEPCIONISTA`, `PERSONALIZADO` |
| `usuario_complejo.status` | `PENDIENTE`, `ACEPTADO`, `SUSPENDIDO` |
| `partidos.tipo_inicio` | `CAPITAN`, `DUEÑO`, `SISTEMA` |
| `partido_confirmaciones.rol_equipo` | `LOCAL`, `VISITANTE` |
| `Team_Miembros.rol` | `CAPITAN`, `SUB_CAPITAN`, `JUGADOR` |
| `Team_Miembros.estado_invitacion` | `PENDIENTE`, `ACEPTADO`, `RECHAZADO` |

### Estructura JSONB `permisos` (usuario_complejo)

Definida en `src/constants/miembroPermisos.js`:

```json
{
  "reservas": {
    "module_reservations": true,
    "create_booking": true,
    "move_reschedule": true,
    "view_daily_income": true,
    "settle_balance": true,
    "free_bookings": true
  },
  "finanzas": {
    "module_finance": true,
    "view_cash_panel": true,
    "view_zyra_settlements": true
  },
  "staff": {
    "module_staff": true,
    "manage_members": true
  },
  "canchas": {
    "module_courts": true,
    "add_court": true,
    "modify_court_identity": true,
    "toggle_court_active": true,
    "maintenance_mode": true,
    "configure_pricing": true,
    "configure_web_section": true
  },
  "analitica": {
    "module_analytics": true,
    "view_analytics": true,
    "view_activity_log": true,
    "view_booking_history": true
  }
}
```

**Roles predefinidos:**
- `ADMINISTRADOR` → todos los permisos en `true`
- `RECEPCIONISTA` → solo permisos básicos de reservas
- `PERSONALIZADO` → todos en `false`, se configuran manualmente

---

## 7. Lógica de negocio clave

### Motor de precios (híbrido)

El precio de una reserva se resuelve en este orden:

1. **`complejo_horarios`** — define si el complejo está abierto ese día.
2. **`calendario_excepciones`** — marca fechas especiales; si `es_festivo = true`, busca precios con `tipo_dia = 7`.
3. **`cancha_horarios_precios`** — precio por franja horaria y tipo de día (0–6 o 7).
4. **`canchas.precio_hora`** — fallback si no hay bloque específico.
5. **`configuracion_horarios_favoritos`** — plantillas JSONB reutilizables (1 por cancha) para configurar bloques rápidamente.

### Reservas

- Pueden existir **sin usuario** (`user_id = null`) usando `nombre_contacto` y `telefono_contacto` (reservas manuales del dueño).
- Modelo de pago por **abono (~30%)** + saldo (`monto_abono` / `monto_total`).
- Trazabilidad completa de **movimientos** (reprogramación) y **cancelaciones** con quién y cuándo.
- Origen registrado: `MANUAL`, `WEB`, `APP`, `API`.

### Control de acceso a complejos

- **Dual:** `complejos.dueño_id` (legacy) + `usuario_complejo` (M:N con RBAC JSONB).
- Invitaciones pendientes mantienen `user_id = NULL` hasta que el invitado se registra/acepta.

### Partidos y equipos

- Cada partido tiene relación **1:1** con una reserva.
- Confirmación dual de marcadores por capitanes; posible estado `DISPUTA`.
- Stats en tres niveles: equipo (`DataTeam`), jugador por partido (`partido_jugador_stats`), jugador por deporte (`usuario_stats_por_sport` con ELO oficial vs casual).

---

## 8. Migraciones existentes

| Archivo | Qué hace |
|---------|----------|
| `src/db/migrations/create_usuario_complejo.sql` | Crea tabla M:N staff, migra dueños existentes |
| `src/db/migrations/add_invitacion_fields_usuario_complejo.sql` | Campos de invitación, ENUMs, índice por correo |
| `src/db/migrations/create_configuracion_horarios_favoritos.sql` | Tabla plantillas JSONB |
| `src/db/migrations/add_cancha_id_to_configuracion_horarios_favoritos.sql` | Agrega `cancha_id` UNIQUE |
| `src/db/migrations/add_unique_indexes_horarios.sql` | UNIQUE en horarios y precios |
| `src/migrations/agregar_columnas_reservas.js` | Campos movimiento/cancelación |
| `src/migrations/agregar_origen_reserva.js` | `origen_reserva`, contacto manual |

> Las migraciones se ejecutan **manualmente**. No hay versionado automático.

---

## 9. Deuda técnica y advertencias

1. **`usuarios` vs `user`:** dos tablas de usuarios; solo `user` está integrada en la app.
2. **`schema.dbml` desactualizado:** no refleja `usuario_complejo`, `configuracion_horarios_favoritos` ni campos nuevos de `reservas`.
3. **`calendario_excepciones.fecha` UNIQUE global:** debería ser `(complejo_id, fecha)` para multi-complejo.
4. **FKs no declaradas en todos los modelos Sequelize** — integridad parcialmente depende de `sync()` y convención.
5. **`sequelize.sync()` en producción** puede alterar esquema de forma impredecible.
6. **Nombres de tablas inconsistentes** (PascalCase vs snake_case) complican queries SQL directas.
7. **Sin tablas de finanzas/transacciones** — ingresos derivados de `reservas`.
8. **Sin seeds** versionados para datos de referencia (`sports`, etc.).

---

## 10. Cómo usar este documento con otra IA

Al pasar contexto a otra IA, incluye:

1. Este archivo completo.
2. Si la tarea es sobre un módulo específico, el modelo Sequelize correspondiente en `src/db/models/`.
3. Las relaciones relevantes de `src/db/db.js`.
4. Para permisos de staff: `src/constants/miembroPermisos.js`.
5. Para lógica de precios/reservas: controladores en `src/controllers/reservaController.js`, `src/controllers/courtPriceController.js`, `src/controllers/finanzasController.js`.

**Entidades más consultadas en desarrollo activo:**
- Reservas: `reservas`, `canchas`, `complejos`, `user`
- Precios: `cancha_horarios_precios`, `complejo_horarios`, `calendario_excepciones`, `configuracion_horarios_favoritos`
- Staff: `usuario_complejo`, `user`, `complejos`
- Partidos: `partidos`, `reservas`, `Team`, `partido_confirmaciones`
