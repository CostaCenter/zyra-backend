# Endpoints de Precios Dinámicos de Canchas - Zyra

Documentación completa de los endpoints para gestionar precios dinámicos por franjas horarias y tipos de día en las canchas deportivas.

## Índice
- [Configurar Precios Dinámicos](#1-configurar-precios-dinámicos)
- [Obtener Configuración de Precios](#2-obtener-configuración-de-precios)
- [Actualizar Franja de Precio](#3-actualizar-franja-de-precio)
- [Eliminar Franja de Precio](#4-eliminar-franja-de-precio)
- [Eliminar Todos los Precios Dinámicos](#5-eliminar-todos-los-precios-dinámicos)
- [Casos de Uso Comunes](#casos-de-uso-comunes)

---

## Conceptos Clave

### Sistema de Precios Híbrido

Zyra maneja dos tipos de precios para las canchas:

1. **Precio Base** (`canchas.precio_hora`): Precio único que se aplica cuando no hay configuración dinámica.
2. **Precios Dinámicos** (`cancha_horarios_precios`): Precios específicos por franja horaria y tipo de día.

**Prioridad**: Si existen precios dinámicos configurados, estos **tienen prioridad** sobre el precio base.

### Tipos de Día (`tipo_dia`)

| Valor | Descripción |
|-------|-------------|
| `0`   | Domingo |
| `1`   | Lunes |
| `2`   | Martes |
| `3`   | Miércoles |
| `4`   | Jueves |
| `5`   | Viernes |
| `6`   | Sábado |
| `7`   | **Festivo** (usado cuando hay excepciones de calendario) |

### Franjas Horarias

Cada franja define:
- **hora_inicio**: Hora de inicio (formato 24h: `HH:MM`)
- **hora_fin**: Hora de fin (formato 24h: `HH:MM`)
- **precio_hora**: Precio por hora en esa franja

**Ejemplo**: De 8:00 a 14:00 → $50,000/hora | De 14:00 a 22:00 → $80,000/hora

---

## 1. Configurar Precios Dinámicos

Configura precios por franjas horarias para una cancha. **Reemplaza toda la configuración anterior**.

**Endpoint:** `POST /api/courts/:id/precios`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID de la cancha

**Body (JSON):**

### Ejemplo 1: Precio diferenciado entre semana y fin de semana

```json
{
  "precios": [
    {
      "tipo_dia": 1,
      "hora_inicio": "08:00",
      "hora_fin": "14:00",
      "precio_hora": 50000
    },
    {
      "tipo_dia": 1,
      "hora_inicio": "14:00",
      "hora_fin": "22:00",
      "precio_hora": 80000
    },
    {
      "tipo_dia": 2,
      "hora_inicio": "08:00",
      "hora_fin": "14:00",
      "precio_hora": 50000
    },
    {
      "tipo_dia": 2,
      "hora_inicio": "14:00",
      "hora_fin": "22:00",
      "precio_hora": 80000
    },
    {
      "tipo_dia": 3,
      "hora_inicio": "08:00",
      "hora_fin": "14:00",
      "precio_hora": 50000
    },
    {
      "tipo_dia": 3,
      "hora_inicio": "14:00",
      "hora_fin": "22:00",
      "precio_hora": 80000
    },
    {
      "tipo_dia": 4,
      "hora_inicio": "08:00",
      "hora_fin": "14:00",
      "precio_hora": 50000
    },
    {
      "tipo_dia": 4,
      "hora_inicio": "14:00",
      "hora_fin": "22:00",
      "precio_hora": 80000
    },
    {
      "tipo_dia": 5,
      "hora_inicio": "08:00",
      "hora_fin": "14:00",
      "precio_hora": 60000
    },
    {
      "tipo_dia": 5,
      "hora_inicio": "14:00",
      "hora_fin": "23:00",
      "precio_hora": 100000
    },
    {
      "tipo_dia": 6,
      "hora_inicio": "09:00",
      "hora_fin": "14:00",
      "precio_hora": 70000
    },
    {
      "tipo_dia": 6,
      "hora_inicio": "14:00",
      "hora_fin": "23:00",
      "precio_hora": 100000
    },
    {
      "tipo_dia": 0,
      "hora_inicio": "10:00",
      "hora_fin": "20:00",
      "precio_hora": 90000
    },
    {
      "tipo_dia": 7,
      "hora_inicio": "08:00",
      "hora_fin": "23:00",
      "precio_hora": 120000
    }
  ]
}
```

### Ejemplo 2: Precio único todo el día (pero diferente por día)

```json
{
  "precios": [
    {
      "tipo_dia": 1,
      "hora_inicio": "08:00",
      "hora_fin": "22:00",
      "precio_hora": 60000
    },
    {
      "tipo_dia": 2,
      "hora_inicio": "08:00",
      "hora_fin": "22:00",
      "precio_hora": 60000
    },
    {
      "tipo_dia": 3,
      "hora_inicio": "08:00",
      "hora_fin": "22:00",
      "precio_hora": 60000
    },
    {
      "tipo_dia": 4,
      "hora_inicio": "08:00",
      "hora_fin": "22:00",
      "precio_hora": 60000
    },
    {
      "tipo_dia": 5,
      "hora_inicio": "08:00",
      "hora_fin": "23:00",
      "precio_hora": 80000
    },
    {
      "tipo_dia": 6,
      "hora_inicio": "09:00",
      "hora_fin": "23:00",
      "precio_hora": 90000
    },
    {
      "tipo_dia": 0,
      "hora_inicio": "10:00",
      "hora_fin": "20:00",
      "precio_hora": 85000
    }
  ]
}
```

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "message": "Precios configurados exitosamente",
  "data": {
    "cancha_id": 5,
    "cancha_nombre": "Cancha de Fútbol 1",
    "precios": [
      {
        "tipo_dia": 0,
        "dia_nombre": "Domingo",
        "franjas": [
          {
            "hora_inicio": "10:00:00",
            "hora_fin": "20:00:00",
            "precio_hora": 90000
          }
        ]
      },
      {
        "tipo_dia": 1,
        "dia_nombre": "Lunes",
        "franjas": [
          {
            "hora_inicio": "08:00:00",
            "hora_fin": "14:00:00",
            "precio_hora": 50000
          },
          {
            "hora_inicio": "14:00:00",
            "hora_fin": "22:00:00",
            "precio_hora": 80000
          }
        ]
      },
      {
        "tipo_dia": 7,
        "dia_nombre": "Festivo",
        "franjas": [
          {
            "hora_inicio": "08:00:00",
            "hora_fin": "23:00:00",
            "precio_hora": 120000
          }
        ]
      }
    ]
  }
}
```

**Errores comunes:**

```json
// 400 - tipo_dia inválido
{
  "success": false,
  "message": "tipo_dia debe ser un número entre 0 (Domingo) y 7 (Festivo)"
}

// 400 - Formato de hora inválido
{
  "success": false,
  "message": "Las horas deben estar en formato HH:MM (24 horas)"
}

// 403 - Sin permisos
{
  "success": false,
  "message": "No tienes permiso para configurar precios de esta cancha"
}

// 404 - Cancha no encontrada
{
  "success": false,
  "message": "Cancha no encontrada"
}
```

---

## 2. Obtener Configuración de Precios

Consulta la configuración de precios actual de una cancha.

**Endpoint:** `GET /api/courts/:id/precios`

**Autenticación:** No requerida (Público)

**Parámetros URL:**
- `id` (number) - ID de la cancha

**Respuesta exitosa (200) - Con precios dinámicos:**

```json
{
  "success": true,
  "message": "Configuración de precios obtenida exitosamente",
  "data": {
    "cancha_id": 5,
    "cancha_nombre": "Cancha de Fútbol 1",
    "precio_base": 70000,
    "tiene_precios_dinamicos": true,
    "precios": [
      {
        "tipo_dia": 0,
        "dia_nombre": "Domingo",
        "franjas": [
          {
            "id": 45,
            "hora_inicio": "10:00:00",
            "hora_fin": "20:00:00",
            "precio_hora": 90000
          }
        ]
      },
      {
        "tipo_dia": 1,
        "dia_nombre": "Lunes",
        "franjas": [
          {
            "id": 46,
            "hora_inicio": "08:00:00",
            "hora_fin": "14:00:00",
            "precio_hora": 50000
          },
          {
            "id": 47,
            "hora_inicio": "14:00:00",
            "hora_fin": "22:00:00",
            "precio_hora": 80000
          }
        ]
      }
    ]
  }
}
```

**Respuesta exitosa (200) - Sin precios dinámicos (usa precio base):**

```json
{
  "success": true,
  "message": "La cancha usa precio base (sin configuración dinámica)",
  "data": {
    "cancha_id": 3,
    "cancha_nombre": "Cancha de Voleibol 2",
    "precio_base": 55000,
    "tiene_precios_dinamicos": false,
    "precios": []
  }
}
```

---

## 3. Actualizar Franja de Precio

Modifica una franja de precio específica sin afectar las demás.

**Endpoint:** `PUT /api/courts/:id/precios/:precioId`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID de la cancha
- `precioId` (number) - ID de la franja de precio (obtenido del GET)

**Body (JSON):**

Puedes actualizar solo los campos que necesites:

```json
{
  "precio_hora": 95000
}
```

O múltiples campos:

```json
{
  "hora_inicio": "08:30",
  "hora_fin": "14:30",
  "precio_hora": 55000
}
```

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "message": "Precio actualizado exitosamente",
  "data": {
    "id": 46,
    "cancha_id": 5,
    "tipo_dia": 1,
    "dia_nombre": "Lunes",
    "hora_inicio": "08:30:00",
    "hora_fin": "14:30:00",
    "precio_hora": 55000
  }
}
```

---

## 4. Eliminar Franja de Precio

Elimina una franja de precio específica.

**Endpoint:** `DELETE /api/courts/:id/precios/:precioId`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID de la cancha
- `precioId` (number) - ID de la franja de precio

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "message": "Precio eliminado exitosamente",
  "data": {
    "id": 46,
    "cancha_id": 5
  }
}
```

---

## 5. Eliminar Todos los Precios Dinámicos

Elimina toda la configuración de precios dinámicos. La cancha volverá a usar el precio base.

**Endpoint:** `DELETE /api/courts/:id/precios`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID de la cancha

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "message": "Todos los precios dinámicos eliminados. La cancha usará el precio base: $70000",
  "data": {
    "cancha_id": 5,
    "configuraciones_eliminadas": 14,
    "precio_base": 70000
  }
}
```

---

## Casos de Uso Comunes

### Caso 1: Precios Prime (Viernes-Sábado más caros)

**Estrategia:**
- Lunes a Jueves: Precio estándar
- Viernes: Precio premium en la noche
- Sábado y Domingo: Precio premium todo el día
- Festivos: Precio ultra premium

```json
{
  "precios": [
    // Lunes a Jueves - Estándar
    {"tipo_dia": 1, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
    {"tipo_dia": 2, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
    {"tipo_dia": 3, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
    {"tipo_dia": 4, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
    
    // Viernes - Premium noche
    {"tipo_dia": 5, "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 60000},
    {"tipo_dia": 5, "hora_inicio": "18:00", "hora_fin": "23:00", "precio_hora": 100000},
    
    // Fin de semana - Premium
    {"tipo_dia": 6, "hora_inicio": "09:00", "hora_fin": "23:00", "precio_hora": 90000},
    {"tipo_dia": 0, "hora_inicio": "10:00", "hora_fin": "20:00", "precio_hora": 85000},
    
    // Festivos - Ultra premium
    {"tipo_dia": 7, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 120000}
  ]
}
```

### Caso 2: Happy Hour (Descuento en horarios de baja demanda)

**Estrategia:**
- Mañanas (8-12): Precio reducido
- Mediodía (12-18): Precio estándar
- Noche (18-22): Precio premium

```json
{
  "precios": [
    // Lunes a Viernes
    {"tipo_dia": 1, "hora_inicio": "08:00", "hora_fin": "12:00", "precio_hora": 40000},
    {"tipo_dia": 1, "hora_inicio": "12:00", "hora_fin": "18:00", "precio_hora": 65000},
    {"tipo_dia": 1, "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 85000},
    
    {"tipo_dia": 2, "hora_inicio": "08:00", "hora_fin": "12:00", "precio_hora": 40000},
    {"tipo_dia": 2, "hora_inicio": "12:00", "hora_fin": "18:00", "precio_hora": 65000},
    {"tipo_dia": 2, "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 85000},
    
    {"tipo_dia": 3, "hora_inicio": "08:00", "hora_fin": "12:00", "precio_hora": 40000},
    {"tipo_dia": 3, "hora_inicio": "12:00", "hora_fin": "18:00", "precio_hora": 65000},
    {"tipo_dia": 3, "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 85000},
    
    {"tipo_dia": 4, "hora_inicio": "08:00", "hora_fin": "12:00", "precio_hora": 40000},
    {"tipo_dia": 4, "hora_inicio": "12:00", "hora_fin": "18:00", "precio_hora": 65000},
    {"tipo_dia": 4, "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 85000},
    
    {"tipo_dia": 5, "hora_inicio": "08:00", "hora_fin": "12:00", "precio_hora": 40000},
    {"tipo_dia": 5, "hora_inicio": "12:00", "hora_fin": "18:00", "precio_hora": 65000},
    {"tipo_dia": 5, "hora_inicio": "18:00", "hora_fin": "23:00", "precio_hora": 95000}
  ]
}
```

### Caso 3: Precio Único Simplificado

**Estrategia:**
- Mismo precio todos los días, todo el día
- Festivos ligeramente más caros

```json
{
  "precios": [
    {"tipo_dia": 0, "hora_inicio": "10:00", "hora_fin": "20:00", "precio_hora": 70000},
    {"tipo_dia": 1, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 70000},
    {"tipo_dia": 2, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 70000},
    {"tipo_dia": 3, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 70000},
    {"tipo_dia": 4, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 70000},
    {"tipo_dia": 5, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 70000},
    {"tipo_dia": 6, "hora_inicio": "09:00", "hora_fin": "23:00", "precio_hora": 70000},
    {"tipo_dia": 7, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 90000}
  ]
}
```

---

## Notas Importantes

1. **Reconfiguración Completa**: `POST /api/courts/:id/precios` elimina todos los precios anteriores antes de crear los nuevos. No es incremental.

2. **Franjas sin Solapamiento**: Asegúrate de que las franjas horarias no se solapen. Por ejemplo:
   - ✅ Correcto: `08:00-14:00` y `14:00-22:00`
   - ❌ Incorrecto: `08:00-15:00` y `14:00-22:00` (se solapan)

3. **Festivos**: El `tipo_dia: 7` se activa automáticamente cuando existe una fecha en `calendario_excepciones` con `es_festivo: true`.

4. **Precio Base vs Dinámico**: Si no hay precios dinámicos configurados, el sistema usa `canchas.precio_hora`. Si existen precios dinámicos, estos tienen prioridad absoluta.

5. **IDs de Franjas**: Los IDs de las franjas (`precioId`) se obtienen haciendo un `GET` previo. No se pueden predecir o calcular.
