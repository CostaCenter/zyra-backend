# Disponibilidad de Complejo - Ejemplos de Uso

## Endpoint
```
GET /api/explorar/complejos/:complejoId/disponibilidad
```

## Descripción
Obtiene la disponibilidad completa de todas las canchas de un complejo específico para un día determinado, mostrando todas las franjas horarias con su estado (LIBRE/OCUPADA) y precios.

---

## Parámetros

### Path Parameters
- `complejoId` (requerido): ID del complejo

### Query Parameters
- `fecha` (requerido): Fecha en formato `YYYY-MM-DD`
- `sport_id` (opcional): Filtrar canchas por ID de deporte
- `deporte` (opcional): Filtrar canchas por nombre de deporte (búsqueda flexible)
- `hora_inicio` (opcional): Hora de referencia en formato `HH:MM` (solo informativa para el frontend)

---

## Ejemplos de Uso

### 1. Consulta básica - Solo fecha
```bash
GET /api/explorar/complejos/5/disponibilidad?fecha=2026-04-25
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Disponibilidad del complejo \"Complejo Deportivo Lima\" para el 2026-04-25",
  "data": {
    "complejo": {
      "id": 5,
      "nombre": "Complejo Deportivo Lima",
      "ubicacion": "San Isidro, Lima",
      "photo": "https://...",
      "wallpaper": "https://..."
    },
    "horarioComplejo": {
      "dia": 4,
      "apertura": "08:00:00",
      "cierre": "22:00:00"
    },
    "fecha": "2026-04-25",
    "hora_referencia": null,
    "totalCanchas": 3,
    "canchas": [
      {
        "id": 10,
        "nombre": "Cancha Fútbol 1",
        "tipo_deporte": "Fútbol",
        "deporte": "Fútbol 11",
        "sport_id": 1,
        "photo": "https://...",
        "detalles": {
          "tipoSuperficie": "Césped sintético",
          "tipoDeCancha": "Fútbol 11",
          "capacidadMaxima": 22,
          "techado": false,
          "iluminacion": true,
          "dimensiones": "100m x 64m",
          "ubicacionInterna": "Campo principal"
        },
        "wallpapers": [
          {
            "id": 1,
            "img_url": "https://...",
            "description": "Vista panorámica"
          },
          {
            "id": 2,
            "img_url": "https://...",
            "description": "Vista nocturna"
          }
        ],
        "franjasHorarias": [
          {
            "hora_inicio": "08:00",
            "hora_fin": "09:00",
            "estado": "LIBRE",
            "precio": 50.00
          },
          {
            "hora_inicio": "09:00",
            "hora_fin": "10:00",
            "estado": "LIBRE",
            "precio": 50.00
          },
          {
            "hora_inicio": "10:00",
            "hora_fin": "11:00",
            "estado": "OCUPADA",
            "precio": null
          },
          {
            "hora_inicio": "11:00",
            "hora_fin": "12:00",
            "estado": "LIBRE",
            "precio": 50.00
          },
          {
            "hora_inicio": "12:00",
            "hora_fin": "13:00",
            "estado": "LIBRE",
            "precio": 60.00
          },
          {
            "hora_inicio": "13:00",
            "hora_fin": "14:00",
            "estado": "OCUPADA",
            "precio": null
          },
          {
            "hora_inicio": "14:00",
            "hora_fin": "15:00",
            "estado": "LIBRE",
            "precio": 60.00
          },
          {
            "hora_inicio": "15:00",
            "hora_fin": "16:00",
            "estado": "LIBRE",
            "precio": 60.00
          },
          {
            "hora_inicio": "16:00",
            "hora_fin": "17:00",
            "estado": "LIBRE",
            "precio": 70.00
          },
          {
            "hora_inicio": "17:00",
            "hora_fin": "18:00",
            "estado": "LIBRE",
            "precio": 70.00
          },
          {
            "hora_inicio": "18:00",
            "hora_fin": "19:00",
            "estado": "LIBRE",
            "precio": 80.00
          },
          {
            "hora_inicio": "19:00",
            "hora_fin": "20:00",
            "estado": "OCUPADA",
            "precio": null
          },
          {
            "hora_inicio": "20:00",
            "hora_fin": "21:00",
            "estado": "LIBRE",
            "precio": 80.00
          },
          {
            "hora_inicio": "21:00",
            "hora_fin": "22:00",
            "estado": "LIBRE",
            "precio": 80.00
          }
        ],
        "resumen": {
          "total": 14,
          "libres": 11,
          "ocupadas": 3
        }
      },
      {
        "id": 11,
        "nombre": "Cancha Fútbol 2",
        "tipo_deporte": "Fútbol",
        "deporte": "Fútbol 7",
        "sport_id": 1,
        "photo": "https://...",
        "detalles": {
          "tipoSuperficie": "Césped sintético",
          "tipoDeCancha": "Fútbol 7",
          "capacidadMaxima": 14,
          "techado": false,
          "iluminacion": true,
          "dimensiones": "60m x 40m",
          "ubicacionInterna": "Campo 2"
        },
        "wallpapers": [],
        "franjasHorarias": [
          {
            "hora_inicio": "08:00",
            "hora_fin": "09:00",
            "estado": "OCUPADA",
            "precio": null
          },
          {
            "hora_inicio": "09:00",
            "hora_fin": "10:00",
            "estado": "LIBRE",
            "precio": 40.00
          }
          // ... más franjas
        ],
        "resumen": {
          "total": 14,
          "libres": 12,
          "ocupadas": 2
        }
      }
    ]
  }
}
```

---

### 2. Filtrar por deporte
```bash
GET /api/explorar/complejos/5/disponibilidad?fecha=2026-04-25&sport_id=1
```

Muestra solo las canchas de fútbol (sport_id=1) con todas sus franjas horarias.

---

### 3. Con hora de referencia
```bash
GET /api/explorar/complejos/5/disponibilidad?fecha=2026-04-25&hora_inicio=18:00
```

Muestra todas las franjas horarias, pero el frontend puede usar `hora_inicio=18:00` para resaltar o posicionarse en esa franja.

---

### 4. Complejo cerrado
```bash
GET /api/explorar/complejos/5/disponibilidad?fecha=2026-04-27
```

**Respuesta cuando el complejo está cerrado ese día:**
```json
{
  "success": true,
  "message": "El complejo está cerrado el día consultado (2026-04-27)",
  "data": {
    "complejo": {
      "id": 5,
      "nombre": "Complejo Deportivo Lima",
      "ubicacion": "San Isidro, Lima",
      "photo": "https://...",
      "wallpaper": "https://..."
    },
    "cerrado": true,
    "fecha": "2026-04-27",
    "dia_semana": 6,
    "canchas": []
  }
}
```

---

### 5. Sin canchas disponibles (por filtros)
```bash
GET /api/explorar/complejos/5/disponibilidad?fecha=2026-04-25&sport_id=99
```

**Respuesta cuando no hay canchas que cumplan los filtros:**
```json
{
  "success": true,
  "message": "No hay canchas disponibles con los filtros especificados",
  "data": {
    "complejo": {
      "id": 5,
      "nombre": "Complejo Deportivo Lima",
      "ubicacion": "San Isidro, Lima",
      "photo": "https://...",
      "wallpaper": "https://..."
    },
    "horarioComplejo": {
      "dia": 4,
      "apertura": "08:00:00",
      "cierre": "22:00:00"
    },
    "fecha": "2026-04-25",
    "canchas": []
  }
}
```

---

## Casos de Error

### Complejo no encontrado
```bash
GET /api/explorar/complejos/99999/disponibilidad?fecha=2026-04-25
```

**Respuesta:**
```json
{
  "success": false,
  "message": "Complejo no encontrado"
}
```

### Fecha requerida
```bash
GET /api/explorar/complejos/5/disponibilidad
```

**Respuesta:**
```json
{
  "success": false,
  "message": "El parámetro \"fecha\" es requerido (formato YYYY-MM-DD)"
}
```

### Formato de fecha inválido
```bash
GET /api/explorar/complejos/5/disponibilidad?fecha=25-04-2026
```

**Respuesta:**
```json
{
  "success": false,
  "message": "fecha debe tener formato YYYY-MM-DD"
}
```

---

## Notas Técnicas

### Franjas Horarias
- Se generan franjas de **60 minutos** entre la hora de apertura y cierre del complejo
- Cada franja muestra su estado individual (LIBRE/OCUPADA)
- Los precios pueden variar por franja horaria según la configuración de `cancha_horarios_precios`

### Precios Dinámicos
- Si existe configuración de precio para esa franja horaria y día → usa ese precio
- Si no existe configuración específica → usa el precio base de la cancha

### Lógica de Ocupación
- Una franja se marca como OCUPADA si existe una reserva activa que se solapa con ese horario
- Solo se consideran reservas con estado diferente a `CANCELADA`

### Detalles y Wallpapers
- `detalles`: Información técnica de la cancha (superficie, capacidad, etc.)
- `wallpapers`: Solo se incluyen imágenes con `state=true` (activas)

---

## Flujo de Uso en Frontend

1. **Usuario busca complejos** → `/api/explorar/complejos?fecha=2026-04-25&hora_inicio=18:00`
2. **Usuario selecciona un complejo** → `/api/explorar/complejos/5/disponibilidad?fecha=2026-04-25&hora_inicio=18:00`
3. **Sistema muestra**:
   - Todas las canchas del complejo
   - Todas las franjas horarias del día
   - Estado de cada franja (LIBRE/OCUPADA)
4. **Usuario puede**:
   - Ver otra fecha → Llamar de nuevo con nueva fecha
   - Seleccionar una franja libre → Proceder a reservar
   - Filtrar por deporte → Agregar `sport_id` al query
