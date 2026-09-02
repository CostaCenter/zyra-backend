# Sistema de Acceso a Complejos - Zyra

## Descripción

Sistema de gestión de accesos que permite a múltiples usuarios tener acceso a múltiples complejos con diferentes roles.

## Arquitectura

### Modelo de Datos

**Tabla: `usuario_complejo`** (Tabla intermedia muchos-a-muchos)
- `id`: Identificador único
- `user_id`: FK a `user.id`
- `complejo_id`: FK a `complejos.id`
- `rol_en_complejo`: Rol del usuario (DUEÑO, ADMIN, ACCESO, EMPLEADO)
- `creado_at`: Fecha de creación del acceso

### Roles Disponibles

- **DUEÑO**: Permisos totales sobre el complejo
- **ADMIN**: Puede gestionar usuarios y configuraciones
- **ACCESO**: Puede ver y operar el complejo
- **EMPLEADO**: Acceso limitado a operaciones básicas

## Instalación

### 1. Ejecutar Migración

```bash
psql -U tu_usuario -d zyra_db -f src/db/migrations/create_usuario_complejo.sql
```

Esta migración:
- Crea la tabla `usuario_complejo`
- Crea índices para mejorar el rendimiento
- Migra automáticamente los dueños existentes con rol DUEÑO

### 2. Reiniciar el servidor

```bash
npm run dev
```

## Endpoints API

### 1. Login (Actualizado)

**POST** `/auth/login`

```json
{
  "telefono": "3001234567",
  "password": "mipassword"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "token": "jwt_token_aqui",
  "user": {
    "id": 1,
    "name": "Juan Pérez",
    "telefono": "3001234567",
    "complejos": [
      {
        "id": 5,
        "nombre": "Complejo Deportivo Central",
        "ubicacion": "Cali",
        "photo": "url_foto",
        "usuario_complejo": {
          "rol_en_complejo": "DUEÑO",
          "creado_at": "2024-01-15T10:30:00.000Z"
        }
      },
      {
        "id": 8,
        "nombre": "Canchas del Valle",
        "ubicacion": "Jamundí",
        "photo": "url_foto",
        "usuario_complejo": {
          "rol_en_complejo": "ADMIN",
          "creado_at": "2024-02-20T14:15:00.000Z"
        }
      }
    ]
  }
}
```

### 2. Otorgar Acceso a Usuario

**POST** `/api/complejos/:complejoId/acceso`

**Headers:**
```
Authorization: Bearer {token}
```

**Body:**
```json
{
  "userId": 15,
  "rol": "ADMIN"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Acceso otorgado exitosamente",
  "data": {
    "id": 23,
    "user_id": 15,
    "complejo_id": 5,
    "rol_en_complejo": "ADMIN",
    "creado_at": "2024-06-12T05:30:00.000Z"
  }
}
```

### 3. Revocar Acceso

**DELETE** `/api/complejos/:complejoId/acceso/:userId`

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Acceso revocado exitosamente"
}
```

### 4. Listar Usuarios con Acceso

**GET** `/api/complejos/:complejoId/acceso`

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Juan Pérez",
      "nick": "juanp",
      "email": "juan@email.com",
      "telefono": "3001234567",
      "photo": "url_foto",
      "usuario_complejo": {
        "rol_en_complejo": "DUEÑO",
        "creado_at": "2024-01-15T10:30:00.000Z"
      }
    },
    {
      "id": 15,
      "name": "María López",
      "nick": "marial",
      "email": "maria@email.com",
      "telefono": "3009876543",
      "photo": "url_foto",
      "usuario_complejo": {
        "rol_en_complejo": "ADMIN",
        "creado_at": "2024-06-12T05:30:00.000Z"
      }
    }
  ]
}
```

### 5. Listar Complejos de un Usuario

**GET** `/api/usuarios/:userId/complejos`

**Headers:**
```
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "nombre": "Complejo Deportivo Central",
      "ubicacion": "Cali",
      "photo": "url_foto",
      "wallpaper": "url_wallpaper",
      "usuario_complejo": {
        "rol_en_complejo": "DUEÑO",
        "creado_at": "2024-01-15T10:30:00.000Z"
      }
    }
  ]
}
```

## Uso en el Código

### Servicio de Accesos

```javascript
import {
  grantAccess,
  revokeAccess,
  getUsersWithAccess,
  getUserComplexes,
  checkAccess,
  hasRole
} from './services/complejoAccessService.js';

// Otorgar acceso
await grantAccess(userId, complejoId, 'ADMIN');

// Verificar acceso
const access = await checkAccess(userId, complejoId);

// Verificar rol específico
const isAdmin = await hasRole(userId, complejoId, ['DUEÑO', 'ADMIN']);

// Obtener complejos de un usuario
const complejos = await getUserComplexes(userId);
```

### Middlewares de Protección

```javascript
import { requireComplejoAccess, requireComplejoRole } from './middlewares/complejoAccessMiddleware.js';
import { verifyToken } from './middlewares/authMiddleware.js';

// Ruta que requiere acceso al complejo
router.get('/api/complejos/:complejoId/datos',
  verifyToken,
  requireComplejoAccess,
  getDatosComplejo
);

// Ruta que requiere rol específico
router.post('/api/complejos/:complejoId/configuracion',
  verifyToken,
  requireComplejoRole(['DUEÑO', 'ADMIN']),
  actualizarConfiguracion
);
```

## Permisos y Seguridad

### Reglas de Negocio

1. **Solo DUEÑO o ADMIN** pueden otorgar/revocar accesos
2. **No se puede eliminar** al DUEÑO de un complejo
3. **Los usuarios solo pueden ver** sus propios complejos (excepto ADMIN global)
4. **Todos los accesos** requieren token JWT válido

### Validaciones

- El usuario debe existir
- El complejo debe existir
- No se pueden crear accesos duplicados
- Los roles deben ser válidos (DUEÑO, ADMIN, ACCESO, EMPLEADO)

## Migración de Datos Existentes

La migración incluye un script que automáticamente:
- Crea registros en `usuario_complejo` para todos los dueños actuales
- Asigna el rol "DUEÑO" a estos registros
- Mantiene el campo `dueño_id` en la tabla `complejos` por compatibilidad

## Testing

### Probar Login con Complejos

1. Crear un usuario y complejo
2. Hacer login
3. Verificar que en la respuesta aparezcan los complejos con acceso

### Probar Gestión de Accesos

```bash
# Otorgar acceso
curl -X POST http://localhost:3000/api/complejos/5/acceso \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"userId": 15, "rol": "ADMIN"}'

# Listar usuarios con acceso
curl -X GET http://localhost:3000/api/complejos/5/acceso \
  -H "Authorization: Bearer {token}"
```

## Notas Importantes

- ✅ **No rompe funcionalidad existente**: El campo `dueño_id` se mantiene
- ✅ **Backward compatible**: Las relaciones anteriores siguen funcionando
- ✅ **Migración automática**: Los dueños existentes se migran automáticamente
- ✅ **Performance optimizado**: Índices creados para búsquedas rápidas
- ✅ **Seguridad reforzada**: Validaciones de permisos en todos los endpoints

## Siguientes Pasos Sugeridos

1. **Frontend**: Actualizar la UI para mostrar los complejos en el dashboard
2. **Invitaciones**: Implementar sistema de invitaciones por email/teléfono
3. **Auditoría**: Agregar logs de cambios de accesos
4. **Notificaciones**: Notificar a usuarios cuando se les otorga/revoca acceso
