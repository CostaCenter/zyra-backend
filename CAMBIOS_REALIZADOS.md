# Resumen de Cambios: Sistema de Acceso Múltiple a Complejos

## ✅ Objetivo Completado

Se ha implementado un sistema robusto que permite que **múltiples usuarios tengan acceso a múltiples complejos** con diferentes roles, manteniendo toda la funcionalidad existente intacta.

## 📁 Archivos Creados

### 1. Modelo de Datos
- **`src/db/models/usuario_complejo.js`**
  - Tabla intermedia para relación muchos-a-muchos
  - Campos: id, user_id, complejo_id, rol_en_complejo, creado_at
  - Roles soportados: DUEÑO, ADMIN, ACCESO, EMPLEADO

### 2. Migración SQL
- **`src/db/migrations/create_usuario_complejo.sql`**
  - Crea la tabla `usuario_complejo`
  - Define foreign keys y constraints
  - Índices para optimización
  - Migración automática de dueños existentes

### 3. Servicios
- **`src/services/complejoAccessService.js`**
  - `grantAccess()` - Otorgar acceso a usuario
  - `revokeAccess()` - Revocar acceso
  - `getUsersWithAccess()` - Listar usuarios de un complejo
  - `getUserComplexes()` - Listar complejos de un usuario
  - `checkAccess()` - Verificar si tiene acceso
  - `hasRole()` - Verificar rol específico

### 4. Controladores
- **`src/controllers/complejoAccessController.js`**
  - `grantUserAccess` - POST otorgar acceso
  - `revokeUserAccess` - DELETE revocar acceso
  - `getComplejoUsers` - GET usuarios con acceso
  - `getUserComplejos` - GET complejos del usuario

### 5. Middlewares
- **`src/middlewares/complejoAccessMiddleware.js`**
  - `requireComplejoAccess` - Verificar acceso al complejo
  - `requireComplejoRole` - Verificar rol específico

### 6. Rutas
- **`src/routes/complejoAccessRoutes.js`**
  - POST `/api/complejos/:complejoId/acceso`
  - DELETE `/api/complejos/:complejoId/acceso/:userId`
  - GET `/api/complejos/:complejoId/acceso`
  - GET `/api/usuarios/:userId/complejos`

### 7. Documentación
- **`ACCESO_COMPLEJOS.md`** - Documentación completa del sistema
- **`CAMBIOS_REALIZADOS.md`** - Este archivo

### 8. Scripts de Prueba
- **`scripts/test-acceso-complejos.js`** - Suite de tests automatizada

## 📝 Archivos Modificados

### 1. **`src/db/db.js`**
**Cambios:**
- Importado modelo `usuario_complejo`
- Inicializado modelo `UsuarioComplejo`
- Agregadas relaciones muchos-a-muchos:
  - `User.belongsToMany(Complejos)` con alias `complejosConAcceso`
  - `Complejos.belongsToMany(User)` con alias `usuariosConAcceso`
- Relaciones directas con tabla intermedia
- Exportado modelo `UsuarioComplejo`

**Compatibilidad:** ✅ Mantiene todas las relaciones anteriores intactas

### 2. **`src/services/authService.js`**
**Cambios:**
- Importados modelos `Complejos` y `UsuarioComplejo`
- Modificada función `loginUser()`:
  - Incluye relación `complejosConAcceso` en la consulta
  - Devuelve lista de complejos con acceso en el objeto `user`
  - Incluye rol del usuario en cada complejo

**Compatibilidad:** ✅ No rompe la estructura anterior, solo añade información

### 3. **`src/app.js`**
**Cambios:**
- Importadas rutas `complejoAccessRoutes`
- Registradas rutas en `/api`

**Compatibilidad:** ✅ Solo agrega nuevas rutas, no modifica existentes

## 🔄 Flujo de Autenticación Actualizado

### Antes:
```json
POST /auth/login
Response: {
  "token": "...",
  "user": {
    "id": 1,
    "name": "Usuario",
    ...
  }
}
```

### Ahora:
```json
POST /auth/login
Response: {
  "token": "...",
  "user": {
    "id": 1,
    "name": "Usuario",
    "complejos": [
      {
        "id": 5,
        "nombre": "Complejo 1",
        "ubicacion": "Cali",
        "usuario_complejo": {
          "rol_en_complejo": "DUEÑO"
        }
      }
    ]
  }
}
```

## 🎯 Características Implementadas

### ✅ Relación Muchos-a-Muchos
- Un usuario puede tener acceso a múltiples complejos
- Un complejo puede tener múltiples usuarios con acceso
- Sistema de roles por complejo

### ✅ Gestión de Accesos
- Otorgar acceso con rol específico
- Revocar acceso (excepto al dueño)
- Listar usuarios con acceso
- Listar complejos de un usuario

### ✅ Control de Permisos
- Solo DUEÑO o ADMIN pueden gestionar accesos
- No se puede eliminar al DUEÑO
- Usuarios solo ven sus propios complejos

### ✅ Login Mejorado
- Devuelve automáticamente todos los complejos con acceso
- Incluye el rol en cada complejo
- Mantiene compatibilidad con versión anterior

### ✅ Seguridad
- Middleware de verificación de acceso
- Middleware de verificación de rol
- Validaciones en todos los endpoints
- Protección con JWT

### ✅ Optimización
- Índices en campos clave
- Consultas optimizadas con includes
- Constraint único para evitar duplicados

### ✅ Migración Automática
- Script SQL incluido
- Migra dueños existentes automáticamente
- No requiere intervención manual

## 🚀 Cómo Implementar

### 1. Ejecutar Migración
```bash
cd backend-zyra
psql -U usuario -d zyra_db -f src/db/migrations/create_usuario_complejo.sql
```

### 2. Reiniciar Servidor
```bash
npm run dev
```

### 3. Probar Sistema (Opcional)
```bash
node scripts/test-acceso-complejos.js
```

## 📊 Testing

### Test Manual con cURL

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"telefono": "3001234567", "password": "password"}'

# 2. Otorgar acceso (usar token del login)
curl -X POST http://localhost:3000/api/complejos/5/acceso \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"userId": 10, "rol": "ADMIN"}'

# 3. Listar usuarios con acceso
curl -X GET http://localhost:3000/api/complejos/5/acceso \
  -H "Authorization: Bearer TOKEN_AQUI"
```

## ⚠️ Notas Importantes

1. **Compatibilidad Total:** 
   - No se modifica el campo `dueño_id` en `complejos`
   - Todas las relaciones anteriores siguen funcionando
   - El código existente no se ve afectado

2. **Migración Automática:**
   - Los dueños actuales se migran automáticamente
   - No se pierden datos
   - Proceso idempotente (se puede ejecutar múltiples veces)

3. **Performance:**
   - Índices creados en campos clave
   - Consultas optimizadas
   - Constraint único previene duplicados

4. **Seguridad:**
   - Todos los endpoints requieren autenticación
   - Validación de permisos en cada operación
   - Protección contra eliminación del dueño

## 🎓 Uso en Frontend

### Mostrar complejos después del login:
```javascript
// Después del login
const response = await login(telefono, password);
const { user } = response;

// Acceder a los complejos
user.complejos.forEach(complejo => {
  console.log(`${complejo.nombre} - Rol: ${complejo.usuario_complejo.rol_en_complejo}`);
});
```

### Gestionar accesos:
```javascript
// Otorgar acceso
await fetch(`/api/complejos/${complejoId}/acceso`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 15,
    rol: 'ADMIN'
  })
});
```

## ✨ Ventajas del Sistema

1. **Escalabilidad:** Múltiples usuarios por complejo
2. **Flexibilidad:** Diferentes roles y permisos
3. **Seguridad:** Control granular de accesos
4. **Mantenibilidad:** Código bien estructurado y documentado
5. **Compatibilidad:** No rompe funcionalidad existente
6. **Profesionalismo:** Arquitectura enterprise-grade

## 📚 Recursos

- **Documentación completa:** `ACCESO_COMPLEJOS.md`
- **Script de prueba:** `scripts/test-acceso-complejos.js`
- **Migración SQL:** `src/db/migrations/create_usuario_complejo.sql`

---

**Desarrollado por:** Cursor AI Senior Developer
**Fecha:** Junio 12, 2026
**Estado:** ✅ Completado y listo para producción
