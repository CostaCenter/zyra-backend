# Endpoint Dashboard - Documentación y Ejemplos

## Endpoint Inicial del Dashboard

### Descripción
Endpoint optimizado para carga inicial del dashboard de administración (Modo Studio). Implementa arquitectura Lazy Loading trayendo únicamente datos estructurales básicos y métricas consolidadas del día consultado.

### Endpoint
```
GET /api/dashboard/init
```

### Autenticación
Requiere token JWT en el header `Authorization`:
```
Authorization: Bearer <token>
```

### Query Parameters

| Parámetro | Tipo | Requerido | Descripción | Ejemplo |
|-----------|------|-----------|-------------|---------|
| `complejo_id` | Integer | ✅ Sí | ID del complejo a consultar | `?complejo_id=1` |
| `fecha` | String | ❌ No | Fecha en formato YYYY-MM-DD (default: 2026-06-12) | `?fecha=2026-06-15` |

### Validaciones de Autorización

1. **Validación de Rol**: El usuario no puede tener el rol `JUGADOR`. Si es jugador, retorna `403 Forbidden`.
2. **Validación de Acceso**: El usuario debe tener acceso explícito al complejo consultado en la tabla `usuario_complejo`. Si no tiene acceso, retorna `403 Forbidden`.

---

## Ejemplos de Uso

### Ejemplo 1: Consulta básica (fecha actual por defecto)

**Request:**
```http
GET /api/dashboard/init?complejo_id=1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "fecha_consultada": "2026-06-12",
  "summary": {
    "ocupacion_porcentaje": 65,
    "horas_disponibles": 28,
    "ingresos_estimados_cop": 450000.00
  },
  "canchas": [
    {
      "id": 1,
      "nombre": "Cancha 1 - Sintética",
      "tipo_deporte": "Fútbol",
      "state": "DISPONIBLE",
      "photo": "https://cdn.zyra.app/canchas/cancha1.jpg",
      "sport": {
        "id": 1,
        "nombre": "Fútbol",
        "icono": "⚽"
      }
    },
    {
      "id": 2,
      "nombre": "Cancha 2 - Voley",
      "tipo_deporte": "Voley",
      "state": "DISPONIBLE",
      "photo": "https://cdn.zyra.app/canchas/cancha2.jpg",
      "sport": {
        "id": 2,
        "nombre": "Voleibol",
        "icono": "🏐"
      }
    }
  ],
  "reservas": [
    {
      "id": 1,
      "cancha_id": 1,
      "fecha": "2026-06-12",
      "hora_inicio": "08:00:00",
      "hora_fin": "09:00:00",
      "duracion_minutos": 60,
      "monto_total": 80000.00,
      "monto_abono": 24000.00,
      "estado_pago": "ABONADA",
      "estado_pago_legible": "Anticipo recibido",
      "estado_reserva": "CONFIRMADA",
      "metodo_pago": "NEQUI",
      "cliente": {
        "id": 15,
        "nombre": "Juan Pérez",
        "telefono": "+57 300 123 4567",
        "photo": "https://cdn.zyra.app/users/juan.jpg"
      }
    },
    {
      "id": 2,
      "cancha_id": 1,
      "fecha": "2026-06-12",
      "hora_inicio": "10:00:00",
      "hora_fin": "11:30:00",
      "duracion_minutos": 90,
      "monto_total": 120000.00,
      "monto_abono": 120000.00,
      "estado_pago": "PAGADA_TOTAL",
      "estado_pago_legible": "Pago Confirmado",
      "estado_reserva": "CONFIRMADA",
      "metodo_pago": "EFECTIVO",
      "cliente": {
        "id": 23,
        "nombre": "María García",
        "telefono": "+57 310 987 6543",
        "photo": null
      }
    }
  ]
}
```

---

### Ejemplo 2: Consulta con fecha específica

**Request:**
```http
GET /api/dashboard/init?complejo_id=1&fecha=2026-06-15
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "success": true,
  "fecha_consultada": "2026-06-15",
  "summary": {
    "ocupacion_porcentaje": 40,
    "horas_disponibles": 48,
    "ingresos_estimados_cop": 280000.00
  },
  "canchas": [
    {
      "id": 1,
      "nombre": "Cancha 1 - Sintética",
      "tipo_deporte": "Fútbol",
      "state": "DISPONIBLE",
      "photo": "https://cdn.zyra.app/canchas/cancha1.jpg",
      "sport": {
        "id": 1,
        "nombre": "Fútbol",
        "icono": "⚽"
      }
    }
  ],
  "reservas": [
    {
      "id": 15,
      "cancha_id": 1,
      "fecha": "2026-06-15",
      "hora_inicio": "14:00:00",
      "hora_fin": "15:00:00",
      "duracion_minutos": 60,
      "monto_total": 80000.00,
      "monto_abono": 80000.00,
      "estado_pago": "PAGADA_TOTAL",
      "estado_pago_legible": "Pago Confirmado",
      "estado_reserva": "CONFIRMADA",
      "metodo_pago": "PAGOS_APP",
      "cliente": {
        "id": 45,
        "nombre": "CarlosMVP",
        "telefono": "+57 320 555 7788",
        "photo": "https://cdn.zyra.app/users/carlos.jpg"
      }
    }
  ]
}
```

---

## Respuestas de Error

### Error 400: Parámetros inválidos

**Caso 1: Sin complejo_id**
```json
{
  "success": false,
  "message": "El parámetro complejo_id es obligatorio"
}
```

**Caso 2: Formato de fecha inválido**
```json
{
  "success": false,
  "message": "Formato de fecha inválido. Use YYYY-MM-DD"
}
```

---

### Error 401: No autenticado

```json
{
  "success": false,
  "message": "No se proporcionó token de autenticación"
}
```

---

### Error 403: Acceso denegado

**Caso 1: Usuario es JUGADOR**
```json
{
  "success": false,
  "message": "Acceso denegado. Los jugadores no tienen permisos para acceder al dashboard"
}
```

**Caso 2: Usuario sin acceso al complejo**
```json
{
  "success": false,
  "message": "No tienes acceso a este complejo"
}
```

---

### Error 404: Sin datos

```json
{
  "success": false,
  "message": "No se encontraron canchas para este complejo"
}
```

---

### Error 500: Error del servidor

```json
{
  "success": false,
  "message": "Error al cargar el dashboard",
  "error": "Detalles del error (solo en modo development)"
}
```

---

## Cálculo de Métricas (Summary)

### 1. Ocupación Porcentaje
```
ocupacion_porcentaje = (bloques_ocupados / total_bloques_disponibles) * 100
```

Donde:
- **total_bloques_disponibles** = (horas_operacion × número_de_canchas)
- **bloques_ocupados** = Suma de todas las reservas en bloques de 1 hora (redondeado hacia arriba)

**Ejemplo:**
- Complejo opera de 08:00 a 22:00 = 14 horas
- Tiene 3 canchas
- Total bloques = 14 × 3 = 42 bloques
- Reservas del día ocupan 28 bloques
- Ocupación = (28 / 42) × 100 = 67%

---

### 2. Horas Disponibles
```
horas_disponibles = total_bloques_disponibles - bloques_ocupados
```

**Ejemplo:**
- Total bloques = 42
- Bloques ocupados = 28
- Horas disponibles = 42 - 28 = 14 horas

---

### 3. Ingresos Estimados (COP)
```
ingresos_estimados_cop = SUM(monto_total) WHERE estado_reserva = 'CONFIRMADA' 
                         AND estado_pago IN ('ABONADA', 'PAGADA_TOTAL')
```

Se suman los montos totales de todas las reservas confirmadas que tengan al menos un anticipo o pago total registrado.

**Ejemplo:**
- Reserva 1: $80,000 (ABONADA)
- Reserva 2: $120,000 (PAGADA_TOTAL)
- Reserva 3: $150,000 (ABONADA)
- Total: $350,000 COP

---

## Notas Técnicas

### Optimizaciones Implementadas

1. **Lazy Loading**: Solo trae datos del día consultado, no historial completo
2. **Cálculos en Backend**: Todas las métricas se calculan en el servidor usando queries SQL optimizadas
3. **Consultas Eficientes**: Uso de Sequelize con joins selectivos e índices
4. **Exclusión de Datos Pesados**: No trae wallpapers, detalles extensos ni historial de pagos

### Consideraciones de Performance

- **Promedio de latencia esperada**: 150-300ms
- **Tamaño de respuesta típico**: 5-15 KB
- **Carga en DB**: 3-4 queries optimizadas
- **Cacheable**: Sí (recomendado 5-10 minutos para fecha actual)

### Próximos Endpoints Complementarios

Para completar el dashboard con datos bajo demanda (lazy loading):

1. `GET /api/dashboard/historial-ingresos?complejo_id=1&mes=06&año=2026` - Historial de ingresos por mes
2. `GET /api/dashboard/estadisticas-canchas?complejo_id=1&rango=semana` - Estadísticas detalladas por cancha
3. `GET /api/dashboard/clientes-frecuentes?complejo_id=1&limit=10` - Top clientes frecuentes
4. `GET /api/dashboard/horarios-pico?complejo_id=1` - Análisis de horarios más solicitados

---

## Ejemplo de Integración Frontend (React)

```javascript
import axios from 'axios';

const fetchDashboardData = async (complejoId, fecha = null) => {
  try {
    const token = localStorage.getItem('authToken');
    
    const params = {
      complejo_id: complejoId
    };
    
    if (fecha) {
      params.fecha = fecha; // Formato: YYYY-MM-DD
    }
    
    const response = await axios.get('/api/dashboard/init', {
      params,
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    const { summary, canchas, reservas } = response.data;
    
    // Actualizar estado del dashboard
    setOcupacion(summary.ocupacion_porcentaje);
    setHorasDisponibles(summary.horas_disponibles);
    setIngresos(summary.ingresos_estimados_cop);
    setCanchas(canchas);
    setReservas(reservas);
    
  } catch (error) {
    if (error.response?.status === 403) {
      console.error('No tienes permisos para acceder a este dashboard');
      // Redirigir a página de error o login
    } else {
      console.error('Error al cargar dashboard:', error);
    }
  }
};
```

---

## Testing con cURL

### Test básico
```bash
curl -X GET "http://localhost:3000/api/dashboard/init?complejo_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test con fecha específica
```bash
curl -X GET "http://localhost:3000/api/dashboard/init?complejo_id=1&fecha=2026-06-15" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test sin token (debe fallar con 401)
```bash
curl -X GET "http://localhost:3000/api/dashboard/init?complejo_id=1"
```

---

**Autor:** Backend Zyra Team  
**Versión:** 1.0.0  
**Fecha:** Junio 2026
