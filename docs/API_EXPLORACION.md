# API de Exploración y Búsqueda de Canchas - Zyra

## Descripción

Este módulo proporciona endpoints para buscar canchas deportivas disponibles con filtros flexibles. Todas las rutas son públicas y no requieren autenticación.

---

## Endpoints

### 1. **Buscar Canchas** 
**GET** `/api/explorar/canchas`

Busca canchas disponibles con filtros flexibles.

#### Query Parameters:

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `q` | string | No | Búsqueda de texto en nombre de cancha o complejo |
| `deporte` | string | No | Nombre del deporte (búsqueda flexible, case-insensitive) |
| `sport_id` | number | No | ID del deporte (filtro estricto) |
| `fecha` | string | No | Fecha en formato YYYY-MM-DD |
| `ubicacion` | string | No | Ubicación del complejo |
| `estado` | string | No | Estado de la cancha (DISPONIBLE, OCUPADA, MANTENIMIENTO, FUERA DE SERVICIO) |

#### Ejemplo de Request:

```bash
GET /api/explorar/canchas?q=sintetica&deporte=futbol&ubicacion=Cali
```

#### Ejemplo de Response:

```json
{
  "success": true,
  "message": "Búsqueda completada exitosamente",
  "data": [
    {
      "id": 1,
      "nombre": "Cancha Sintética Pro",
      "tipo_deporte": "Fútbol",
      "sport_id": 1,
      "precio_hora": "50000.00",
      "state": "DISPONIBLE",
      "photo": "https://...",
      "complejo": {
        "id": 1,
        "nombre": "Complejo Deportivo Central",
        "ubicacion": "Cali",
        "photo": "https://...",
        "wallpaper": "https://..."
      },
      "sport": {
        "id": 1,
        "name": "Fútbol",
        "state": "Disponible"
      }
    }
  ],
  "count": 1,
  "filters": {
    "q": "sintetica",
    "deporte": "futbol",
    "ubicacion": "Cali"
  }
}
```

---

### 2. **Buscar Canchas con Paginación**
**GET** `/api/explorar/canchas/paginado`

Busca canchas con soporte de paginación.

#### Query Parameters:

Todos los parámetros de búsqueda anteriores, más:

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `page` | number | No | 1 | Número de página |
| `limit` | number | No | 10 | Límite de resultados por página (máx: 100) |

#### Ejemplo de Request:

```bash
GET /api/explorar/canchas/paginado?deporte=voley&page=1&limit=5
```

#### Ejemplo de Response:

```json
{
  "success": true,
  "message": "Búsqueda paginada completada exitosamente",
  "data": [
    {
      "id": 5,
      "nombre": "Cancha de Voley Playa",
      "tipo_deporte": "Voley",
      "sport_id": 2,
      "precio_hora": "35000.00",
      "state": "DISPONIBLE",
      "complejo": {
        "id": 2,
        "nombre": "Complejo Playero",
        "ubicacion": "Jamundí"
      },
      "sport": {
        "id": 2,
        "name": "Voley"
      }
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 5,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "deporte": "voley"
  }
}
```

---

### 3. **Obtener Estadísticas de Búsqueda**
**GET** `/api/explorar/estadisticas`

Retorna estadísticas agregadas de la búsqueda.

#### Query Parameters:

Mismos parámetros que la búsqueda de canchas.

#### Ejemplo de Request:

```bash
GET /api/explorar/estadisticas?ubicacion=Cali
```

#### Ejemplo de Response:

```json
{
  "success": true,
  "message": "Estadísticas obtenidas exitosamente",
  "data": {
    "total": 25,
    "byDeporte": {
      "Fútbol": 15,
      "Voley": 7,
      "Basketball": 3
    },
    "byUbicacion": {
      "Cali": 20,
      "Jamundí": 5
    },
    "byComplejo": {
      "Complejo Deportivo Central": 10,
      "Complejo Playero": 8,
      "Arena Sports": 7
    }
  },
  "filters": {
    "ubicacion": "Cali"
  }
}
```

---

### 4. **Listar Deportes Disponibles**
**GET** `/api/explorar/deportes`

Lista todos los deportes disponibles con el conteo de canchas.

#### Ejemplo de Request:

```bash
GET /api/explorar/deportes
```

#### Ejemplo de Response:

```json
{
  "success": true,
  "message": "Deportes listados exitosamente",
  "data": [
    {
      "id": 1,
      "name": "Fútbol",
      "state": "Disponible",
      "totalCanchas": 25
    },
    {
      "id": 2,
      "name": "Voley",
      "state": "Disponible",
      "totalCanchas": 12
    }
  ],
  "count": 2
}
```

---

### 5. **Listar Ubicaciones Disponibles**
**GET** `/api/explorar/ubicaciones`

Lista todas las ubicaciones con canchas disponibles.

#### Ejemplo de Request:

```bash
GET /api/explorar/ubicaciones
```

#### Ejemplo de Response:

```json
{
  "success": true,
  "message": "Ubicaciones listadas exitosamente",
  "data": [
    {
      "ubicacion": "Cali",
      "totalCanchas": 35
    },
    {
      "ubicacion": "Jamundí",
      "totalCanchas": 15
    }
  ],
  "count": 2
}
```

---

## Casos de Uso Comunes

### 1. Búsqueda Simple por Texto

```bash
# Buscar cualquier cancha que contenga "sintética" en su nombre o en el nombre del complejo
GET /api/explorar/canchas?q=sintética
```

### 2. Filtrar por Deporte Específico

```bash
# Buscar todas las canchas de fútbol
GET /api/explorar/canchas?deporte=futbol

# O usando el ID del deporte (más preciso)
GET /api/explorar/canchas?sport_id=1
```

### 3. Filtrar por Ubicación

```bash
# Buscar canchas en Cali
GET /api/explorar/canchas?ubicacion=Cali
```

### 4. Búsqueda Combinada

```bash
# Buscar canchas de voley en Jamundí que estén disponibles
GET /api/explorar/canchas?deporte=voley&ubicacion=Jamundí&estado=DISPONIBLE
```

### 5. Búsqueda con Paginación

```bash
# Obtener la segunda página de canchas de fútbol (10 por página)
GET /api/explorar/canchas/paginado?deporte=futbol&page=2&limit=10
```

### 6. Búsqueda de Texto Flexible

```bash
# Buscar "central" en nombres de canchas o complejos
GET /api/explorar/canchas?q=central

# Resultado: puede retornar "Cancha Central", "Complejo Central", etc.
```

---

## Características Técnicas

### Búsqueda Flexible (ILIKE)

- La búsqueda de texto (`q`) utiliza operador `ILIKE` de PostgreSQL (case-insensitive)
- Busca en:
  - Nombre de la cancha
  - Nombre del complejo
- Ejemplo: `q=sint` encuentra "Sintética", "sintetica", "SINTETICA"

### Filtrado por Deporte

- **`deporte`**: Búsqueda flexible por nombre (usa ILIKE)
  - Ejemplo: `deporte=fut` encuentra "Fútbol", "Futbol", "futsal"
- **`sport_id`**: Filtro estricto por ID
  - Ejemplo: `sport_id=1` solo encuentra canchas con sport_id = 1

### Estados de Cancha

Valores válidos para el parámetro `estado`:
- `DISPONIBLE` (default)
- `OCUPADA`
- `MANTENIMIENTO`
- `FUERA DE SERVICIO`

### Relaciones Incluidas

Cada cancha retorna:
- **Complejo**: Información del complejo deportivo (nombre, ubicación, fotos)
- **Sport**: Información del deporte (nombre, estado)

---

## Manejo de Errores

### Error 400 - Bad Request

```json
{
  "success": false,
  "message": "El formato de fecha debe ser YYYY-MM-DD"
}
```

### Error 500 - Internal Server Error

```json
{
  "success": false,
  "message": "Error al buscar canchas",
  "error": "Detalle del error (solo en desarrollo)"
}
```

---

## Notas de Implementación

1. **Performance**: Las búsquedas utilizan índices en las tablas de Sequelize
2. **Paginación**: Límite máximo de 100 resultados por página
3. **Case-insensitive**: Todas las búsquedas de texto son case-insensitive
4. **INNER JOIN**: Se asegura que cada cancha tenga un complejo asociado
5. **Ordenamiento**: Por defecto, ordena por nombre de cancha y complejo (ASC)

---

## TODO / Mejoras Futuras

- [ ] Implementar filtro de disponibilidad por fecha/hora usando horarios y reservas
- [ ] Agregar filtro por rango de precios
- [ ] Implementar búsqueda geográfica (por coordenadas y radio)
- [ ] Agregar caché para mejorar performance en búsquedas frecuentes
- [ ] Implementar rate limiting para prevenir abuse
- [ ] Agregar sugerencias de búsqueda (autocomplete)
