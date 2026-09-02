# ⚙️ Configuración Inicial - Sistema de Autenticación Zyra

## 📝 Paso a Paso

### 1. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
# Configuración del Servidor
PORT=3000
NODE_ENV=development

# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zyra_db
DB_USER=postgres
DB_PASSWORD=tu_password

# JWT (JSON Web Token) - ⚠️ IMPORTANTE: Cambia este secret
JWT_SECRET=tu_secret_super_seguro_aqui_minimo_32_caracteres_aleatorios
```

**⚠️ MUY IMPORTANTE:** El `JWT_SECRET` debe ser una cadena larga y aleatoria. En producción, usa algo como:
```
JWT_SECRET=8f3e9d7a6b2c4f1e5d8a7b9c2d4e6f8a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e
```

### 2. Verificar Instalación de Dependencias

Las dependencias ya están instaladas:
- ✅ `bcryptjs`: Para hashear contraseñas
- ✅ `jsonwebtoken`: Para tokens JWT

### 3. Iniciar el Servidor

```bash
# Modo desarrollo (con nodemon)
npm run dev

# Modo producción
npm start
```

### 4. Probar el Sistema

Una vez que el servidor esté corriendo, deberías ver:

```
✅ Base de datos sincronizada y modelos de Zyra cargados
🚀 Servidor corriendo en el puerto 3000
```

## 🧪 Pruebas Rápidas

### Prueba 1: Registrar un Usuario

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@zyra.com",
    "password": "test123",
    "nombre": "Usuario",
    "apellido": "Prueba"
  }'
```

### Prueba 2: Hacer Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@zyra.com",
    "password": "test123"
  }'
```

Copia el `token` de la respuesta.

### Prueba 3: Acceder a Ruta Protegida

```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

## 📂 Archivos Creados

```
backend-zyra/
├── src/
│   ├── app.js                      ← Actualizado con authRoutes
│   ├── services/
│   │   └── authService.js          ← Lógica de negocio (NEW)
│   ├── controllers/
│   │   └── authController.js       ← Handlers HTTP (NEW)
│   ├── middlewares/
│   │   └── authMiddleware.js       ← Verificación JWT (NEW)
│   └── routes/
│       └── authRoutes.js           ← Rutas /auth/* (NEW)
├── package.json                     ← Actualizado con bcryptjs y jsonwebtoken
└── AUTH_README.md                   ← Documentación completa (NEW)
```

## 🔐 Endpoints Disponibles

| Método | Endpoint | Descripción | Protegido |
|--------|----------|-------------|-----------|
| POST | `/auth/register` | Registrar usuario | ❌ No |
| POST | `/auth/login` | Iniciar sesión | ❌ No |
| GET | `/auth/me` | Obtener usuario actual | ✅ Sí |

## 🛡️ Usar el Middleware en Otras Rutas

Para proteger cualquier ruta en tu aplicación:

```javascript
import { verifyToken, verifyRole } from './middlewares/authMiddleware.js';

// Ruta protegida simple
router.get('/mi-ruta-protegida', verifyToken, (req, res) => {
  // req.user contiene el usuario autenticado
  res.json({ user: req.user });
});

// Ruta protegida con verificación de rol
router.post('/admin/crear-complejo', 
  verifyToken, 
  verifyRole(['admin', 'owner']), 
  (req, res) => {
    // Solo admin u owner pueden crear complejos
    res.json({ message: 'Complejo creado' });
  }
);
```

## ✅ Checklist de Verificación

- [ ] Archivo `.env` creado con `JWT_SECRET`
- [ ] Base de datos PostgreSQL corriendo
- [ ] Servidor inicia sin errores
- [ ] Endpoint `/auth/register` funciona
- [ ] Endpoint `/auth/login` funciona y devuelve token
- [ ] Endpoint `/auth/me` funciona con token válido
- [ ] Endpoint `/auth/me` rechaza peticiones sin token

## 🚨 Solución de Problemas

### Error: "JWT_SECRET is not defined"
**Solución:** Verifica que el archivo `.env` existe y contiene `JWT_SECRET=...`

### Error: "Unable to connect to the database"
**Solución:** Verifica que PostgreSQL está corriendo y las credenciales en `.env` son correctas

### Error: "Token inválido"
**Solución:** Asegúrate de incluir el header `Authorization: Bearer <token>`

### Error: "Usuario ya existe"
**Solución:** El email o username ya están registrados. Usa datos diferentes.

## 📚 Documentación Adicional

Lee `AUTH_README.md` para documentación detallada sobre:
- Estructura completa del sistema
- Validaciones implementadas
- Códigos de error
- Mejores prácticas de seguridad
- Ejemplos de uso avanzado

## 🎉 ¡Listo!

El sistema de autenticación está completamente implementado y listo para usar.

**Próximos pasos sugeridos:**
1. Implementar rutas protegidas para complejos
2. Agregar refresh tokens
3. Implementar verificación de email
4. Agregar recuperación de contraseña
