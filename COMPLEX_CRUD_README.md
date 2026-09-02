# 🏟️ CRUD de Complejos - Zyra Backend

## 📋 Descripción

Sistema completo de CRUD (Crear, Leer, Actualizar, Eliminar) para complejos deportivos, completamente integrado con el sistema de autenticación JWT.

## 🔧 Características

- ✅ Crear complejos (requiere autenticación)
- ✅ Listar todos los complejos (público)
- ✅ Listar complejos propios (requiere autenticación)
- ✅ Ver detalle de un complejo (público)
- ✅ Actualizar complejo (solo el dueño)
- ✅ Eliminar complejo (solo el dueño)
- ✅ Vinculación automática con el usuario autenticado
- ✅ Validación de permisos (solo el dueño puede editar/eliminar)

## 📁 Estructura de Archivos

```
src/
├── services/
│   └── complexService.js          # Lógica de negocio de complejos
├── controllers/
│   └── complexController.js       # Handlers HTTP para complejos
└── routes/
    └── complexRoutes.js           # Rutas de complejos
```

## 🚀 Endpoints

### Base URL: `/api/complexes`

| Método | Endpoint | Protegido | Descripción |
|--------|----------|-----------|-------------|
| POST | `/` | ✅ Sí | Crear nuevo complejo |
| GET | `/` | ❌ No | Listar todos los complejos |
| GET | `/my-complexes` | ✅ Sí | Listar complejos del usuario autenticado |
| GET | `/:id` | ❌ No | Obtener complejo por ID |
| PUT | `/:id` | ✅ Sí (solo dueño) | Actualizar complejo |
| DELETE | `/:id` | ✅ Sí (solo dueño) | Eliminar complejo |

---

## 📝 Documentación de Endpoints

### 1. Crear Complejo

**POST** `/api/complexes`

**Requiere Autenticación:** ✅ Sí

**Headers:**
```
Authorization: Bearer <tu_token_jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "nombre": "Complejo Deportivo La Victoria",
  "ubicacion": "Cali, Valle del Cauca",
  "photo": "https://ejemplo.com/foto-complejo.jpg",
  "wallpaper": "https://ejemplo.com/wallpaper-complejo.jpg"
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "message": "Complejo creado exitosamente",
  "data": {
    "id": 1,
    "nombre": "Complejo Deportivo La Victoria",
    "ubicacion": "Cali, Valle del Cauca",
    "dueño_id": 5,
    "photo": "https://ejemplo.com/foto-complejo.jpg",
    "wallpaper": "https://ejemplo.com/wallpaper-complejo.jpg"
  }
}
```

**Notas:**
- El `dueño_id` se extrae automáticamente del token JWT
- Solo el campo `nombre` es obligatorio
- Los campos `photo` y `wallpaper` son opcionales

---

### 2. Listar Todos los Complejos (Público)

**GET** `/api/complexes`

**Requiere Autenticación:** ❌ No

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Lista de complejos",
  "data": [
    {
      "id": 1,
      "nombre": "Complejo Deportivo La Victoria",
      "ubicacion": "Cali, Valle del Cauca",
      "dueño_id": 5,
      "photo": "https://ejemplo.com/foto1.jpg",
      "wallpaper": "https://ejemplo.com/wallpaper1.jpg",
      "dueño": {
        "id": 5,
        "name": "Jorge López",
        "nick": "jorgelopez",
        "photo": "https://ejemplo.com/foto-jorge.jpg"
      }
    },
    {
      "id": 2,
      "nombre": "Canchas El Estadio",
      "ubicacion": "Jamundí",
      "dueño_id": 3,
      "photo": "https://ejemplo.com/foto2.jpg",
      "wallpaper": "https://ejemplo.com/wallpaper2.jpg",
      "dueño": {
        "id": 3,
        "name": "María García",
        "nick": "mariagarcia",
        "photo": "https://ejemplo.com/foto-maria.jpg"
      }
    }
  ],
  "count": 2
}
```

---

### 3. Listar Mis Complejos (Usuario Autenticado)

**GET** `/api/complexes/my-complexes`

**Requiere Autenticación:** ✅ Sí

**Headers:**
```
Authorization: Bearer <tu_token_jwt>
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Complejos del usuario",
  "data": [
    {
      "id": 1,
      "nombre": "Complejo Deportivo La Victoria",
      "ubicacion": "Cali, Valle del Cauca",
      "dueño_id": 5,
      "photo": "https://ejemplo.com/foto1.jpg",
      "wallpaper": "https://ejemplo.com/wallpaper1.jpg",
      "dueño": {
        "id": 5,
        "name": "Jorge López",
        "nick": "jorgelopez",
        "telefono": "+573001234567",
        "photo": "https://ejemplo.com/foto-jorge.jpg"
      }
    }
  ],
  "count": 1
}
```

**Notas:**
- Solo muestra los complejos donde el usuario autenticado es el dueño
- Útil para que Jorge vea solo sus complejos

---

### 4. Obtener Complejo por ID

**GET** `/api/complexes/:id`

**Requiere Autenticación:** ❌ No

**Ejemplo:** `GET /api/complexes/1`

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Complejo encontrado",
  "data": {
    "id": 1,
    "nombre": "Complejo Deportivo La Victoria",
    "ubicacion": "Cali, Valle del Cauca",
    "dueño_id": 5,
    "photo": "https://ejemplo.com/foto1.jpg",
    "wallpaper": "https://ejemplo.com/wallpaper1.jpg",
    "dueño": {
      "id": 5,
      "name": "Jorge López",
      "nick": "jorgelopez",
      "telefono": "+573001234567",
      "photo": "https://ejemplo.com/foto-jorge.jpg"
    }
  }
}
```

**Respuesta Error (404):**
```json
{
  "success": false,
  "message": "Complejo no encontrado"
}
```

---

### 5. Actualizar Complejo

**PUT** `/api/complexes/:id`

**Requiere Autenticación:** ✅ Sí (solo el dueño)

**Headers:**
```
Authorization: Bearer <tu_token_jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "nombre": "Complejo Deportivo La Victoria - Actualizado",
  "ubicacion": "Cali, Colombia",
  "photo": "https://ejemplo.com/nueva-foto.jpg"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Complejo actualizado exitosamente",
  "data": {
    "id": 1,
    "nombre": "Complejo Deportivo La Victoria - Actualizado",
    "ubicacion": "Cali, Colombia",
    "dueño_id": 5,
    "photo": "https://ejemplo.com/nueva-foto.jpg",
    "wallpaper": "https://ejemplo.com/wallpaper1.jpg"
  }
}
```

**Respuesta Error (403) - Sin Permisos:**
```json
{
  "success": false,
  "message": "No tienes permiso para editar este complejo"
}
```

**Notas:**
- Solo puedes actualizar tus propios complejos
- Puedes enviar solo los campos que quieras actualizar

---

### 6. Eliminar Complejo

**DELETE** `/api/complexes/:id`

**Requiere Autenticación:** ✅ Sí (solo el dueño)

**Headers:**
```
Authorization: Bearer <tu_token_jwt>
```

**Ejemplo:** `DELETE /api/complexes/1`

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Complejo eliminado exitosamente"
}
```

**Respuesta Error (403) - Sin Permisos:**
```json
{
  "success": false,
  "message": "No tienes permiso para eliminar este complejo"
}
```

**Respuesta Error (404):**
```json
{
  "success": false,
  "message": "Complejo no encontrado"
}
```

---

## 🎯 Ejemplos de Uso

### Ejemplo 1: Crear un complejo

```bash
curl -X POST http://localhost:3000/api/complexes \
  -H "Authorization: Bearer tu_token_jwt_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Complejo Deportivo La Victoria",
    "ubicacion": "Cali, Valle del Cauca",
    "photo": "https://ejemplo.com/foto.jpg"
  }'
```

### Ejemplo 2: Ver mis complejos (Jorge)

```bash
curl -X GET http://localhost:3000/api/complexes/my-complexes \
  -H "Authorization: Bearer tu_token_jwt_aqui"
```

### Ejemplo 3: Listar todos los complejos (público)

```bash
curl -X GET http://localhost:3000/api/complexes
```

### Ejemplo 4: Actualizar un complejo

```bash
curl -X PUT http://localhost:3000/api/complexes/1 \
  -H "Authorization: Bearer tu_token_jwt_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Nuevo Nombre del Complejo",
    "ubicacion": "Nueva Ubicación"
  }'
```

### Ejemplo 5: Eliminar un complejo

```bash
curl -X DELETE http://localhost:3000/api/complexes/1 \
  -H "Authorization: Bearer tu_token_jwt_aqui"
```

---

## 🔐 Seguridad y Validaciones

### Validaciones Implementadas:

1. **Crear Complejo:**
   - ✅ Token JWT válido requerido
   - ✅ Campo `nombre` obligatorio
   - ✅ Usuario dueño debe existir

2. **Actualizar Complejo:**
   - ✅ Token JWT válido requerido
   - ✅ Solo el dueño puede actualizar
   - ✅ El complejo debe existir

3. **Eliminar Complejo:**
   - ✅ Token JWT válido requerido
   - ✅ Solo el dueño puede eliminar
   - ✅ El complejo debe existir

### Permisos:

- **Público:** Ver todos los complejos, ver detalle de un complejo
- **Usuario Autenticado:** Crear complejos, ver sus propios complejos
- **Dueño del Complejo:** Actualizar y eliminar solo sus complejos

---

## ⚠️ Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200 | Operación exitosa |
| 201 | Recurso creado exitosamente |
| 400 | Datos inválidos o faltantes |
| 401 | No autenticado o token inválido |
| 403 | Sin permisos (no eres el dueño) |
| 404 | Recurso no encontrado |
| 500 | Error del servidor |

---

## 🔄 Flujo de Trabajo

### Escenario 1: Jorge crea un complejo

1. Jorge hace login → obtiene su token JWT
2. Jorge crea un complejo con POST `/api/complexes`
3. El sistema extrae el `dueño_id` del token automáticamente
4. El complejo se crea vinculado a Jorge

### Escenario 2: Jorge ve sus complejos

1. Jorge hace GET `/api/complexes/my-complexes` con su token
2. El sistema devuelve solo los complejos donde Jorge es el dueño

### Escenario 3: Usuario público ve todos los complejos

1. Usuario hace GET `/api/complexes` (sin token)
2. El sistema devuelve todos los complejos disponibles

### Escenario 4: Jorge actualiza su complejo

1. Jorge hace PUT `/api/complexes/1` con su token
2. El sistema verifica que Jorge es el dueño del complejo 1
3. Si es correcto, actualiza el complejo
4. Si no es el dueño, devuelve error 403

---

## 🛠️ Integración con el Modelo de Datos

El servicio utiliza el modelo `Complejos` que tiene la siguiente estructura:

```javascript
{
  id: INTEGER (PK, autoincrement),
  nombre: STRING,
  ubicacion: STRING,
  dueño_id: INTEGER (FK → user.id),
  photo: TEXT,
  wallpaper: TEXT
}
```

**Relación con User:**
- `Complejos.belongsTo(User, { foreignKey: 'dueño_id', as: 'dueño' })`
- Permite incluir datos del dueño en las consultas

---

## 📊 Modelo de Datos Completo

```
user (tabla)
├── id
├── name
├── nick
├── photo
├── telefono
└── ...

complejos (tabla)
├── id
├── nombre
├── ubicacion
├── dueño_id (FK → user.id)
├── photo
└── wallpaper
```

---

## 🎨 Próximas Mejoras

- [ ] Paginación para la lista de complejos
- [ ] Búsqueda y filtros (por ubicación, nombre)
- [ ] Subida de imágenes (integración con cloud storage)
- [ ] Sistema de favoritos
- [ ] Calificaciones y reseñas
- [ ] Estadísticas del complejo
- [ ] Gestión de canchas dentro del complejo

---

## ✅ Resumen

El CRUD de Complejos está completamente funcional y vinculado al sistema de autenticación. Los usuarios pueden:

- ✅ Crear complejos autenticados
- ✅ Ver todos los complejos públicamente
- ✅ Ver solo sus propios complejos
- ✅ Actualizar solo sus propios complejos
- ✅ Eliminar solo sus propios complejos

**¡Sistema listo para usar!** 🚀
