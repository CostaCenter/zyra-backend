# Migración: Agregar origen_reserva y campos de contacto

## Descripción

Esta migración agrega tres nuevos campos a la tabla `reservas`:

1. **origen_reserva**: Identifica de dónde provino la reserva (MANUAL, WEB, APP, API)
2. **telefono_contacto**: Teléfono para reservas manuales sin usuario registrado
3. **nombre_contacto**: Nombre para reservas manuales sin usuario registrado

## ¿Por qué es necesaria?

Permite al sistema:
- Diferenciar entre reservas creadas manualmente por administradores vs. creadas por clientes
- Mantener información de contacto para clientes no registrados
- Generar estadísticas por canal de reserva
- Buscar historial de clientes por teléfono, estén o no registrados en el sistema

## Cómo ejecutar la migración

### Opción 1: Ejecutar directamente con Node

```bash
cd backend-zyra
node src/migrations/agregar_origen_reserva.js
```

### Opción 2: Ejecutar con npm script

Agregar al `package.json`:

```json
{
  "scripts": {
    "migrate:origen": "node src/migrations/agregar_origen_reserva.js"
  }
}
```

Luego ejecutar:

```bash
npm run migrate:origen
```

### Opción 3: Ejecutar manualmente en MySQL

```sql
ALTER TABLE reservas 
ADD COLUMN origen_reserva VARCHAR(20) NOT NULL DEFAULT 'WEB' COMMENT 'Origen de la reserva: MANUAL, WEB, APP, API',
ADD COLUMN telefono_contacto VARCHAR(20) NULL COMMENT 'Teléfono de contacto para reservas manuales sin user_id',
ADD COLUMN nombre_contacto VARCHAR(100) NULL COMMENT 'Nombre de contacto para reservas manuales sin user_id';
```

## Verificar la migración

Después de ejecutar, verificar que las columnas existen:

```sql
DESCRIBE reservas;
```

Deberías ver las nuevas columnas:
- `origen_reserva` VARCHAR(20) NOT NULL DEFAULT 'WEB'
- `telefono_contacto` VARCHAR(20) NULL
- `nombre_contacto` VARCHAR(100) NULL

## Actualizar reservas existentes (opcional)

Si quieres actualizar reservas existentes para indicar su origen:

```sql
-- Marcar reservas con user_id como WEB (creadas por clientes)
UPDATE reservas 
SET origen_reserva = 'WEB' 
WHERE user_id IS NOT NULL;

-- Si tienes reservas sin user_id, probablemente sean manuales
UPDATE reservas 
SET origen_reserva = 'MANUAL' 
WHERE user_id IS NULL;
```

## Endpoints nuevos

### GET /api/reservas/historial-cliente/:telefono

Obtiene el historial de reservas de un cliente por su teléfono.

**Parámetros de query:**
- `complejo_id` (requerido): ID del complejo

**Ejemplo:**
```bash
GET /api/reservas/historial-cliente/3001234567?complejo_id=1
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "cliente": {
    "telefono": "3001234567",
    "nombre": "Felipe Aristizábal",
    "email": "felipe@example.com",
    "user_id": 123,
    "es_cliente_registrado": true
  },
  "estadisticas": {
    "total_reservas": 15,
    "reservas_finalizadas": 13,
    "reservas_canceladas": 2,
    "reservas_no_show": 0,
    "tiene_incumplimientos": true,
    "tasa_cumplimiento": 87
  },
  "historial": [...]
}
```

## Valores permitidos para origen_reserva

- **MANUAL**: Reserva creada por administrador desde el dashboard
- **WEB**: Reserva creada por cliente desde la aplicación web
- **APP**: Reserva creada por cliente desde la aplicación móvil
- **API**: Reserva creada por integración externa

## Revertir la migración

Si necesitas revertir los cambios:

```sql
ALTER TABLE reservas 
DROP COLUMN origen_reserva,
DROP COLUMN telefono_contacto,
DROP COLUMN nombre_contacto;
```

O ejecutar con Node:

```javascript
import { down } from './src/migrations/agregar_origen_reserva.js';
down();
```
