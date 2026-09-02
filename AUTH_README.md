# Sistema de Autenticación - Zyra Backend

## 📋 Descripción

Sistema de autenticación profesional implementado con **bcryptjs** y **jsonwebtoken** para el backend de Zyra.

## 🔧 Configuración

### Variables de Entorno

Asegúrate de tener configurada la variable `JWT_SECRET` en tu archivo `.env`:

```env
JWT_SECRET=tu_secret_super_seguro_aqui
```

### Dependencias Instaladas

- `bcryptjs`: Para hashear contraseñas
- `jsonwebtoken`: Para generar y verificar tokens JWT

## 📁 Estructura de Archivos

```
src/
├── services/
│   └── authService.js          # Lógica de negocio (registro, login)
├── controllers/
│   └── authController.js       # Handlers HTTP
├── middlewares/
│   └── authMiddleware.js       # Verificación de tokens JWT
└── routes/
    └── authRoutes.js           # Definición de rutas
```

## 🚀 Endpoints

### 1. Registro de Usuario

**POST** `/auth/register`

**Body:**
```json
{
  "username": "usuario123",
  "email": "usuario@ejemplo.com",
  "password": "password123",
  "nombre": "Juan",
  "apellido": "Pérez",
  "telefono": "+54911234567",
  "fecha_nacimiento": "1990-01-15"
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "id": 1,
    "username": "usuario123",
    "email": "usuario@ejemplo.com",
    "nombre": "Juan",
    "apellido": "Pérez",
    "rol": "user",
    "is_verified": false
  }
}
```

### 2. Login

**POST** `/auth/login`

**Body:**
```json
{
  "identifier": "usuario@ejemplo.com",
  "password": "password123"
}
```

*Nota: `identifier` puede ser email o username*

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "usuario123",
      "email": "usuario@ejemplo.com",
      "nombre": "Juan",
      "apellido": "Pérez",
      "rol": "user"
    }
  }
}
```

### 3. Obtener Usuario Actual (Ruta Protegida)

**GET** `/auth/me`

**Headers:**
```
Authorization: Bearer <tu_token_jwt>
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Usuario autenticado",
  "data": {
    "id": 1,
    "username": "usuario123",
    "email": "usuario@ejemplo.com",
    "nombre": "Juan",
    "apellido": "Pérez",
    "rol": "user"
  }
}
```

## 🔒 Middleware de Autenticación

### verifyToken

Protege rutas que requieren autenticación. Verifica el JWT en el header `Authorization`.

**Uso:**
```javascript
import { verifyToken } from './middlewares/authMiddleware.js';

router.get('/ruta-protegida', verifyToken, (req, res) => {
  // req.user contiene los datos del usuario autenticado
  // req.userId contiene el ID del usuario
  res.json({ user: req.user });
});
```

### verifyRole

Verifica que el usuario tenga uno de los roles permitidos.

**Uso:**
```javascript
import { verifyToken, verifyRole } from './middlewares/authMiddleware.js';

router.post('/admin/action', 
  verifyToken, 
  verifyRole(['admin', 'owner']), 
  (req, res) => {
    // Solo usuarios con rol 'admin' u 'owner' pueden acceder
    res.json({ message: 'Acción de admin' });
  }
);
```

## 🔐 Seguridad

- Las contraseñas se hashean con **bcryptjs** usando salt rounds de 10
- Los tokens JWT expiran en **7 días**
- Las contraseñas deben tener al menos **6 caracteres**
- El formato de email se valida con regex
- Los tokens se verifican en cada petición a rutas protegidas

## 📝 Validaciones

### Registro:
- Username, email y password son **obligatorios**
- Email debe tener formato válido
- Password mínimo 6 caracteres
- Username y email deben ser **únicos**

### Login:
- Identifier (email o username) y password son **obligatorios**
- Las credenciales se validan contra la base de datos

## 🎯 Ejemplos de Uso

### Registro con cURL:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "usuario123",
    "email": "usuario@ejemplo.com",
    "password": "password123",
    "nombre": "Juan",
    "apellido": "Pérez"
  }'
```

### Login con cURL:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "usuario@ejemplo.com",
    "password": "password123"
  }'
```

### Acceder a ruta protegida con cURL:
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer tu_token_jwt_aqui"
```

## ⚠️ Códigos de Estado HTTP

- **200**: Operación exitosa
- **201**: Recurso creado exitosamente
- **400**: Datos inválidos o faltantes
- **401**: No autenticado o token inválido/expirado
- **403**: No autorizado (sin permisos)
- **409**: Conflicto (usuario ya existe)
- **500**: Error del servidor

## 🔄 Flujo de Autenticación

1. **Registro**: El usuario se registra con sus datos → se hashea la contraseña → se guarda en BD
2. **Login**: El usuario envía credenciales → se valida contraseña → se genera JWT → se devuelve token
3. **Acceso a rutas protegidas**: Se envía el token en el header → se verifica token → se permite acceso

## 🛠️ Mantenimiento

Para cambiar la duración del token, edita `src/services/authService.js`:

```javascript
const token = jwt.sign(
  { /* payload */ },
  process.env.JWT_SECRET,
  { expiresIn: '7d' } // Cambiar aquí (ej: '1h', '30d', '90d')
);
```
