# Sistema de Exploración y Búsqueda de Canchas - Zyra

## 📋 Resumen de Implementación

Se ha creado un sistema completo de búsqueda y exploración de canchas deportivas con las siguientes características:

### 🎯 Componentes Creados

#### 1. **Servicio de Búsqueda** (`src/services/searchService.js`)
- `searchCourts()`: Búsqueda flexible con múltiples filtros
- `searchCourtsWithPagination()`: Búsqueda con soporte de paginación
- `getSearchStats()`: Estadísticas agregadas de búsqueda

#### 2. **Controlador de Exploración** (`src/controllers/explorarController.js`)
- `buscarCanchas`: Endpoint principal de búsqueda
- `buscarCanchasPaginado`: Búsqueda con paginación
- `obtenerEstadisticas`: Estadísticas de resultados
- `listarDeportes`: Lista de deportes disponibles
- `listarUbicaciones`: Lista de ubicaciones con canchas

#### 3. **Rutas** (`src/routes/explorarRoutes.js`)
- `GET /api/explorar/canchas` - Búsqueda principal
- `GET /api/explorar/canchas/paginado` - Con paginación
- `GET /api/explorar/estadisticas` - Estadísticas
- `GET /api/explorar/deportes` - Lista deportes
- `GET /api/explorar/ubicaciones` - Lista ubicaciones

#### 4. **Integración** (`src/app.js`)
- Rutas registradas en el servidor principal
- Todas las rutas son públicas (no requieren autenticación)

---

## ✨ Características Principales

### 🔍 Búsqueda Flexible

**Parámetros de Query Soportados:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `q` | string | Busca en nombre de cancha y complejo (ILIKE) |
| `deporte` | string | Filtra por nombre de deporte (flexible) |
| `sport_id` | number | Filtra por ID de deporte (estricto) |
| `ubicacion` | string | Filtra por ubicación del complejo |
| `estado` | string | Estado de la cancha (default: DISPONIBLE) |
| `fecha` | string | Fecha para disponibilidad (YYYY-MM-DD) |
| `page` | number | Número de página (paginación) |
| `limit` | number | Límite por página (max: 100) |

### 🎨 Características Técnicas

1. **Case-Insensitive**: Todas las búsquedas ignoran mayúsculas/minúsculas
2. **Búsqueda Parcial**: Encuentra coincidencias parciales (ej: "sint" → "Sintética")
3. **Relaciones Incluidas**: Cada resultado incluye:
   - Información del complejo (nombre, ubicación, fotos)
   - Información del deporte (nombre, estado)
4. **Paginación**: Soporte completo con metadatos (total, hasNext, hasPrev)
5. **Validación**: Validación robusta de parámetros con mensajes de error claros
6. **Performance**: Uso de Sequelize.Op para consultas optimizadas

### 📊 Endpoints Disponibles

```
BASE URL: http://localhost:3000/api/explorar
```

1. **Búsqueda Principal**
   ```
   GET /canchas?q=texto&deporte=futbol&ubicacion=Cali
   ```

2. **Búsqueda Paginada**
   ```
   GET /canchas/paginado?deporte=voley&page=1&limit=10
   ```

3. **Estadísticas**
   ```
   GET /estadisticas?ubicacion=Cali
   ```

4. **Listar Deportes**
   ```
   GET /deportes
   ```

5. **Listar Ubicaciones**
   ```
   GET /ubicaciones
   ```

---

## 🚀 Ejemplos de Uso

### Ejemplo 1: Búsqueda Simple
```bash
GET /api/explorar/canchas?q=sintética
```

**Resultado**: Todas las canchas que contengan "sintética" en su nombre o en el nombre del complejo.

### Ejemplo 2: Filtrar por Deporte y Ubicación
```bash
GET /api/explorar/canchas?deporte=futbol&ubicacion=Cali
```

**Resultado**: Canchas de fútbol ubicadas en Cali.

### Ejemplo 3: Paginación
```bash
GET /api/explorar/canchas/paginado?page=1&limit=10
```

**Resultado**: Primera página con 10 canchas.

### Ejemplo 4: Estadísticas
```bash
GET /api/explorar/estadisticas
```

**Resultado**: Conteo de canchas por deporte, ubicación y complejo.

---

## 📁 Estructura de Archivos

```
backend-zyra/
├── src/
│   ├── controllers/
│   │   └── explorarController.js ✨ (NUEVO)
│   ├── services/
│   │   └── searchService.js ✨ (NUEVO)
│   ├── routes/
│   │   └── explorarRoutes.js ✨ (NUEVO)
│   ├── app.js (ACTUALIZADO)
│   └── db/
│       ├── db.js
│       └── models/
│           ├── complejos.js
│           ├── canchas.js
│           └── sports.js
└── docs/
    ├── API_EXPLORACION.md ✨ (NUEVO)
    └── API_EXPLORACION_TESTS.http ✨ (NUEVO)
```

---

## 🔧 Configuración

### 1. Las rutas ya están registradas en `app.js`:

```javascript
import explorarRoutes from './routes/explorarRoutes.js';
app.use('/api/explorar', explorarRoutes);
```

### 2. No requiere configuración adicional
- Utiliza los modelos existentes de Sequelize
- No requiere migraciones adicionales
- Compatible con PostgreSQL (usa ILIKE)

---

## ✅ Validaciones Implementadas

1. **Formato de Fecha**: Valida YYYY-MM-DD
2. **sport_id**: Valida que sea un número
3. **Paginación**: 
   - page >= 1
   - limit entre 1 y 100
4. **Manejo de Errores**: Respuestas JSON estructuradas

---

## 🎯 Casos de Uso Cubiertos

### Para el Usuario Final:
- ✅ Buscar canchas por nombre
- ✅ Filtrar por deporte favorito
- ✅ Buscar por ubicación
- ✅ Ver canchas disponibles
- ✅ Explorar deportes disponibles
- ✅ Ver ubicaciones con canchas

### Para la Aplicación:
- ✅ Paginación para listas largas
- ✅ Estadísticas para dashboards
- ✅ Filtros combinados
- ✅ Búsqueda rápida (autocomplete ready)

---

## 🚦 Cómo Probar

### 1. Usando Thunder Client (VS Code)
- Abre el archivo `docs/API_EXPLORACION_TESTS.http`
- Haz clic en "Send Request" sobre cada endpoint

### 2. Usando cURL
```bash
# Búsqueda simple
curl http://localhost:3000/api/explorar/canchas?q=sintetica

# Con filtros
curl http://localhost:3000/api/explorar/canchas?deporte=futbol&ubicacion=Cali
```

### 3. Usando Postman
- Importa los ejemplos del archivo de tests
- Configura la base URL
- Ejecuta las requests

---

## 📈 Próximas Mejoras Sugeridas

1. **Disponibilidad Real**: Integrar con horarios y reservas
2. **Filtro por Precio**: Rango de precios
3. **Geolocalización**: Búsqueda por coordenadas y radio
4. **Cache**: Redis para búsquedas frecuentes
5. **Rate Limiting**: Protección contra abuse
6. **Autocomplete**: Sugerencias de búsqueda
7. **Favoritos**: Sistema de favoritos por usuario
8. **Reseñas**: Filtrar por puntuación

---

## 🐛 Solución de Problemas

### Error: "No se encontraron canchas"
- Verifica que la base de datos tenga datos
- Revisa los filtros aplicados

### Error 500 en búsqueda
- Verifica la conexión a la base de datos
- Revisa los logs del servidor

### Paginación no funciona
- Verifica que page y limit sean números válidos
- Máximo: limit = 100

---

## 📚 Documentación

- **API Completa**: `docs/API_EXPLORACION.md`
- **Tests**: `docs/API_EXPLORACION_TESTS.http`
- **Este README**: `docs/RESUMEN_EXPLORACION.md`

---

## 👨‍💻 Implementado por

- **Arquitectura**: Clean Architecture / Service Pattern
- **ORM**: Sequelize
- **Base de Datos**: PostgreSQL
- **Búsqueda**: Case-insensitive con operadores ILIKE
- **Validación**: Validaciones robustas en controlador
- **Respuestas**: JSON estructurado con success/error

---

## 🎉 Estado: ✅ COMPLETO Y LISTO PARA USAR

Todos los endpoints están implementados, probados y documentados.
Las rutas están registradas y listas para recibir peticiones.
