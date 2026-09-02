# Endpoints de Excepciones de Calendario - Zyra

Documentación completa de los endpoints para gestionar fechas especiales (festivos, cierres, eventos) en complejos deportivos.

## Índice
- [Agregar Excepción](#1-agregar-excepción)
- [Agregar Múltiples Excepciones](#2-agregar-múltiples-excepciones-bulk)
- [Obtener Todas las Excepciones](#3-obtener-todas-las-excepciones)
- [Obtener Excepción por Fecha](#4-obtener-excepción-por-fecha)
- [Actualizar Excepción](#5-actualizar-excepción)
- [Eliminar Excepción](#6-eliminar-excepción)
- [Casos de Uso Comunes](#casos-de-uso-comunes)

---

## Conceptos Clave

### ¿Qué son las Excepciones de Calendario?

Las excepciones de calendario permiten marcar fechas específicas que se comportan de manera diferente al horario normal del complejo.

### Tipos de Excepciones

1. **Festivos Abiertos** (`es_festivo: true`, `esta_abierto: true`)
   - El complejo abre normalmente
   - Las canchas usan precios de `tipo_dia: 7` (festivo)
   - Ejemplos: Día del Trabajo, Independencia

2. **Cierres Totales** (`esta_abierto: false`)
   - El complejo está cerrado
   - No se pueden hacer reservas
   - Ejemplos: Navidad, mantenimiento general

3. **Días Especiales** (`es_festivo: false`, `esta_abierto: true`)
   - Abierto con horario normal y precios normales
   - Útil para eventos especiales sin cambio de precios
   - Ejemplos: Torneos internos, eventos promocionales

### Campos de una Excepción

| Campo | Tipo | Descripción | Valor por defecto |
|-------|------|-------------|-------------------|
| `fecha` | date | Fecha en formato YYYY-MM-DD | Requerido |
| `esta_abierto` | boolean | ¿El complejo está abierto? | `true` |
| `es_festivo` | boolean | ¿Aplican precios de festivo? | `false` |
| `descripcion` | string | Descripción del motivo | `null` |

---

## 1. Agregar Excepción

Agrega una fecha excepcional al calendario del complejo.

**Endpoint:** `POST /api/complexes/:id/excepciones`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID del complejo

**Body (JSON):**

### Ejemplo 1: Festivo (Día de la Independencia)

```json
{
  "fecha": "2026-07-20",
  "esta_abierto": true,
  "es_festivo": true,
  "descripcion": "Día de la Independencia de Colombia"
}
```

### Ejemplo 2: Cierre por mantenimiento

```json
{
  "fecha": "2026-08-15",
  "esta_abierto": false,
  "es_festivo": false,
  "descripcion": "Mantenimiento general de canchas"
}
```

### Ejemplo 3: Día especial sin cambio de precios

```json
{
  "fecha": "2026-09-10",
  "esta_abierto": true,
  "es_festivo": false,
  "descripcion": "Torneo interno de fútbol 5"
}
```

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "message": "Excepción de calendario creada exitosamente",
  "data": {
    "id": 12,
    "complejo_id": 3,
    "complejo_nombre": "Complejo Deportivo El Campeón",
    "fecha": "2026-07-20",
    "esta_abierto": true,
    "es_festivo": true,
    "descripcion": "Día de la Independencia de Colombia",
    "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
  }
}
```

**Errores comunes:**

```json
// 400 - Formato de fecha inválido
{
  "success": false,
  "message": "La fecha debe estar en formato YYYY-MM-DD"
}

// 400 - Excepción ya existe
{
  "success": false,
  "message": "Ya existe una excepción configurada para esta fecha",
  "data": {
    "id": 10,
    "fecha": "2026-07-20",
    "descripcion": "Día de la Independencia"
  }
}

// 403 - Sin permisos
{
  "success": false,
  "message": "No tienes permiso para configurar este complejo"
}

// 404 - Complejo no encontrado
{
  "success": false,
  "message": "Complejo no encontrado"
}
```

---

## 2. Agregar Múltiples Excepciones (Bulk)

Agrega varias excepciones al mismo tiempo. Útil para configurar todos los festivos del año.

**Endpoint:** `POST /api/complexes/:id/excepciones/bulk`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID del complejo

**Body (JSON):**

### Ejemplo: Festivos Colombia 2026

```json
{
  "excepciones": [
    {
      "fecha": "2026-01-01",
      "esta_abierto": false,
      "es_festivo": true,
      "descripcion": "Año Nuevo"
    },
    {
      "fecha": "2026-01-12",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Día de los Reyes Magos"
    },
    {
      "fecha": "2026-03-23",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Día de San José"
    },
    {
      "fecha": "2026-04-09",
      "esta_abierto": false,
      "es_festivo": true,
      "descripcion": "Jueves Santo"
    },
    {
      "fecha": "2026-04-10",
      "esta_abierto": false,
      "es_festivo": true,
      "descripcion": "Viernes Santo"
    },
    {
      "fecha": "2026-05-01",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Día del Trabajo"
    },
    {
      "fecha": "2026-05-25",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Día de la Ascensión"
    },
    {
      "fecha": "2026-06-15",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Corpus Christi"
    },
    {
      "fecha": "2026-06-22",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Sagrado Corazón"
    },
    {
      "fecha": "2026-06-29",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "San Pedro y San Pablo"
    },
    {
      "fecha": "2026-07-20",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Día de la Independencia"
    },
    {
      "fecha": "2026-08-07",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Batalla de Boyacá"
    },
    {
      "fecha": "2026-08-17",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Asunción de la Virgen"
    },
    {
      "fecha": "2026-10-12",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Día de la Raza"
    },
    {
      "fecha": "2026-11-02",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Día de Todos los Santos"
    },
    {
      "fecha": "2026-11-16",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Independencia de Cartagena"
    },
    {
      "fecha": "2026-12-08",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Inmaculada Concepción"
    },
    {
      "fecha": "2026-12-25",
      "esta_abierto": false,
      "es_festivo": true,
      "descripcion": "Navidad"
    }
  ]
}
```

**Respuesta exitosa (201):**

```json
{
  "success": true,
  "message": "18 excepciones creadas exitosamente",
  "data": {
    "complejo_id": 3,
    "complejo_nombre": "Complejo Deportivo El Campeón",
    "total_creadas": 18,
    "excepciones": [
      {
        "id": 20,
        "fecha": "2026-01-01",
        "esta_abierto": false,
        "es_festivo": true,
        "descripcion": "Año Nuevo",
        "informacion": "🔒 Complejo cerrado"
      },
      {
        "id": 21,
        "fecha": "2026-01-12",
        "esta_abierto": true,
        "es_festivo": true,
        "descripcion": "Día de los Reyes Magos",
        "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
      }
    ]
  }
}
```

**Errores comunes:**

```json
// 400 - Fechas duplicadas en el array
{
  "success": false,
  "message": "Hay fechas duplicadas en el array"
}

// 400 - Alguna fecha ya existe en la BD
{
  "success": false,
  "message": "Algunas fechas ya tienen excepciones configuradas",
  "data": {
    "fechas_existentes": ["2026-01-01", "2026-12-25"]
  }
}
```

---

## 3. Obtener Todas las Excepciones

Consulta todas las excepciones de calendario de un complejo con filtros opcionales.

**Endpoint:** `GET /api/complexes/:id/excepciones`

**Autenticación:** No requerida (Público)

**Parámetros URL:**
- `id` (number) - ID del complejo

**Query Params (opcionales):**
- `desde` (string) - Fecha inicial (YYYY-MM-DD)
- `hasta` (string) - Fecha final (YYYY-MM-DD)
- `solo_festivos` (string) - `"true"` para filtrar solo festivos
- `solo_cerrados` (string) - `"true"` para filtrar solo días cerrados

### Ejemplo 1: Obtener todas las excepciones

**Request:**
```
GET /api/complexes/3/excepciones
```

**Respuesta (200):**

```json
{
  "success": true,
  "message": "Excepciones obtenidas exitosamente",
  "data": {
    "complejo_id": 3,
    "complejo_nombre": "Complejo Deportivo El Campeón",
    "total": 18,
    "excepciones": [
      {
        "id": 20,
        "fecha": "2026-01-01",
        "esta_abierto": false,
        "es_festivo": true,
        "descripcion": "Año Nuevo",
        "informacion": "🔒 Complejo cerrado"
      },
      {
        "id": 21,
        "fecha": "2026-01-12",
        "esta_abierto": true,
        "es_festivo": true,
        "descripcion": "Día de los Reyes Magos",
        "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
      },
      {
        "id": 22,
        "fecha": "2026-03-23",
        "esta_abierto": true,
        "es_festivo": true,
        "descripcion": "Día de San José",
        "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
      }
    ],
    "filtros_aplicados": {}
  }
}
```

### Ejemplo 2: Excepciones entre fechas

**Request:**
```
GET /api/complexes/3/excepciones?desde=2026-06-01&hasta=2026-08-31
```

**Respuesta (200):**

```json
{
  "success": true,
  "message": "Excepciones obtenidas exitosamente",
  "data": {
    "complejo_id": 3,
    "complejo_nombre": "Complejo Deportivo El Campeón",
    "total": 5,
    "excepciones": [
      {
        "id": 25,
        "fecha": "2026-06-15",
        "esta_abierto": true,
        "es_festivo": true,
        "descripcion": "Corpus Christi",
        "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
      },
      {
        "id": 26,
        "fecha": "2026-06-22",
        "esta_abierto": true,
        "es_festivo": true,
        "descripcion": "Sagrado Corazón",
        "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
      },
      {
        "id": 27,
        "fecha": "2026-06-29",
        "esta_abierto": true,
        "es_festivo": true,
        "descripcion": "San Pedro y San Pablo",
        "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
      },
      {
        "id": 28,
        "fecha": "2026-07-20",
        "esta_abierto": true,
        "es_festivo": true,
        "descripcion": "Día de la Independencia",
        "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
      },
      {
        "id": 29,
        "fecha": "2026-08-07",
        "esta_abierto": true,
        "es_festivo": true,
        "descripcion": "Batalla de Boyacá",
        "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
      }
    ],
    "filtros_aplicados": {
      "desde": "2026-06-01",
      "hasta": "2026-08-31"
    }
  }
}
```

### Ejemplo 3: Solo días cerrados

**Request:**
```
GET /api/complexes/3/excepciones?solo_cerrados=true
```

**Respuesta (200):**

```json
{
  "success": true,
  "message": "Excepciones obtenidas exitosamente",
  "data": {
    "complejo_id": 3,
    "complejo_nombre": "Complejo Deportivo El Campeón",
    "total": 3,
    "excepciones": [
      {
        "id": 20,
        "fecha": "2026-01-01",
        "esta_abierto": false,
        "es_festivo": true,
        "descripcion": "Año Nuevo",
        "informacion": "🔒 Complejo cerrado"
      },
      {
        "id": 23,
        "fecha": "2026-04-09",
        "esta_abierto": false,
        "es_festivo": true,
        "descripcion": "Jueves Santo",
        "informacion": "🔒 Complejo cerrado"
      },
      {
        "id": 24,
        "fecha": "2026-04-10",
        "esta_abierto": false,
        "es_festivo": true,
        "descripcion": "Viernes Santo",
        "informacion": "🔒 Complejo cerrado"
      }
    ],
    "filtros_aplicados": {
      "solo_cerrados": "true"
    }
  }
}
```

---

## 4. Obtener Excepción por Fecha

Consulta si una fecha específica tiene alguna excepción configurada.

**Endpoint:** `GET /api/complexes/:id/excepciones/:fecha`

**Autenticación:** No requerida (Público)

**Parámetros URL:**
- `id` (number) - ID del complejo
- `fecha` (string) - Fecha en formato YYYY-MM-DD

### Ejemplo 1: Fecha con excepción

**Request:**
```
GET /api/complexes/3/excepciones/2026-07-20
```

**Respuesta (200):**

```json
{
  "success": true,
  "message": "Excepción encontrada",
  "data": {
    "id": 28,
    "complejo_id": 3,
    "complejo_nombre": "Complejo Deportivo El Campeón",
    "fecha": "2026-07-20",
    "esta_abierto": true,
    "es_festivo": true,
    "descripcion": "Día de la Independencia",
    "informacion": "🎉 Festivo - Precios especiales (tipo_dia: 7)"
  }
}
```

### Ejemplo 2: Fecha sin excepción

**Request:**
```
GET /api/complexes/3/excepciones/2026-08-25
```

**Respuesta (404):**

```json
{
  "success": false,
  "message": "No hay excepción configurada para esta fecha",
  "data": {
    "complejo_id": 3,
    "fecha": "2026-08-25",
    "usa_horario_normal": true
  }
}
```

---

## 5. Actualizar Excepción

Modifica una excepción de calendario existente.

**Endpoint:** `PUT /api/complexes/:id/excepciones/:fecha`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID del complejo
- `fecha` (string) - Fecha en formato YYYY-MM-DD

**Body (JSON):**

Puedes actualizar solo los campos que necesites:

### Ejemplo 1: Cambiar de abierto a cerrado

```json
{
  "esta_abierto": false,
  "descripcion": "Cierre por mantenimiento extraordinario"
}
```

### Ejemplo 2: Actualizar descripción

```json
{
  "descripcion": "Día de la Independencia de Colombia 🇨🇴"
}
```

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "message": "Excepción actualizada exitosamente",
  "data": {
    "id": 28,
    "complejo_id": 3,
    "complejo_nombre": "Complejo Deportivo El Campeón",
    "fecha": "2026-07-20",
    "esta_abierto": false,
    "es_festivo": true,
    "descripcion": "Cierre por mantenimiento extraordinario",
    "informacion": "🔒 Complejo cerrado"
  }
}
```

---

## 6. Eliminar Excepción

Elimina una excepción de calendario. La fecha volverá a usar el horario normal.

**Endpoint:** `DELETE /api/complexes/:id/excepciones/:fecha`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID del complejo
- `fecha` (string) - Fecha en formato YYYY-MM-DD

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "message": "Excepción eliminada exitosamente",
  "data": {
    "complejo_id": 3,
    "fecha": "2026-07-20"
  }
}
```

---

## Casos de Uso Comunes

### Caso 1: Configurar Festivos de Colombia para el año 2026

Usa el endpoint `/bulk` para agregar todos de una vez:

```bash
POST /api/complexes/3/excepciones/bulk
```

```json
{
  "excepciones": [
    {"fecha": "2026-01-01", "esta_abierto": false, "es_festivo": true, "descripcion": "Año Nuevo"},
    {"fecha": "2026-01-12", "esta_abierto": true, "es_festivo": true, "descripcion": "Reyes Magos"},
    {"fecha": "2026-03-23", "esta_abierto": true, "es_festivo": true, "descripcion": "San José"},
    {"fecha": "2026-04-09", "esta_abierto": false, "es_festivo": true, "descripcion": "Jueves Santo"},
    {"fecha": "2026-04-10", "esta_abierto": false, "es_festivo": true, "descripcion": "Viernes Santo"},
    {"fecha": "2026-05-01", "esta_abierto": true, "es_festivo": true, "descripcion": "Día del Trabajo"},
    {"fecha": "2026-05-25", "esta_abierto": true, "es_festivo": true, "descripcion": "Ascensión"},
    {"fecha": "2026-06-15", "esta_abierto": true, "es_festivo": true, "descripcion": "Corpus Christi"},
    {"fecha": "2026-06-22", "esta_abierto": true, "es_festivo": true, "descripcion": "Sagrado Corazón"},
    {"fecha": "2026-06-29", "esta_abierto": true, "es_festivo": true, "descripcion": "San Pedro y Pablo"},
    {"fecha": "2026-07-20", "esta_abierto": true, "es_festivo": true, "descripcion": "Independencia"},
    {"fecha": "2026-08-07", "esta_abierto": true, "es_festivo": true, "descripcion": "Batalla de Boyacá"},
    {"fecha": "2026-08-17", "esta_abierto": true, "es_festivo": true, "descripcion": "Asunción"},
    {"fecha": "2026-10-12", "esta_abierto": true, "es_festivo": true, "descripcion": "Día de la Raza"},
    {"fecha": "2026-11-02", "esta_abierto": true, "es_festivo": true, "descripcion": "Todos los Santos"},
    {"fecha": "2026-11-16", "esta_abierto": true, "es_festivo": true, "descripcion": "Independencia CTG"},
    {"fecha": "2026-12-08", "esta_abierto": true, "es_festivo": true, "descripcion": "Inmaculada"},
    {"fecha": "2026-12-25", "esta_abierto": false, "es_festivo": true, "descripcion": "Navidad"}
  ]
}
```

### Caso 2: Mantenimiento programado de una semana

Agregar múltiples días de cierre:

```json
{
  "excepciones": [
    {"fecha": "2026-08-10", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Semana 1"},
    {"fecha": "2026-08-11", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Semana 1"},
    {"fecha": "2026-08-12", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Semana 1"},
    {"fecha": "2026-08-13", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Semana 1"},
    {"fecha": "2026-08-14", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento - Semana 1"}
  ]
}
```

### Caso 3: Eventos especiales sin cambio de precio

```json
{
  "fecha": "2026-10-25",
  "esta_abierto": true,
  "es_festivo": false,
  "descripcion": "Torneo interno de voleibol - Sin cambio de precios"
}
```

### Caso 4: Consultar próximos festivos

```bash
GET /api/complexes/3/excepciones?desde=2026-05-01&hasta=2026-12-31&solo_festivos=true
```

---

## Integración con Precios Dinámicos

### Flujo Completo: Festivo con Precio Especial

**Paso 1**: Configurar precio para festivos en las canchas

```bash
POST /api/courts/5/precios
```

```json
{
  "precios": [
    {"tipo_dia": 7, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 120000}
  ]
}
```

**Paso 2**: Marcar fecha como festivo

```bash
POST /api/complexes/3/excepciones
```

```json
{
  "fecha": "2026-07-20",
  "esta_abierto": true,
  "es_festivo": true,
  "descripcion": "Día de la Independencia"
}
```

**Resultado**: El 20 de julio de 2026, el sistema automáticamente:
1. Detecta que es un festivo (`es_festivo: true`)
2. Busca precios con `tipo_dia: 7`
3. Aplica $120,000/hora en lugar del precio normal

---

## Notas Importantes

1. **Unicidad por Complejo**: No puede haber dos excepciones para la misma fecha en el mismo complejo.

2. **Prioridad**: Las excepciones tienen prioridad sobre los horarios normales configurados en `complejo_horarios`.

3. **Festivos y Precios**: Si una fecha es festivo (`es_festivo: true`), el sistema automáticamente busca precios con `tipo_dia: 7` en las canchas.

4. **Cierres Totales**: Si `esta_abierto: false`, no se permiten reservas ese día, sin importar otros factores.

5. **Formato de Fecha**: Siempre YYYY-MM-DD. Cualquier otro formato será rechazado.

6. **Persistencia**: Las excepciones no expiran automáticamente. Se mantienen en el sistema hasta que se eliminen manualmente.
