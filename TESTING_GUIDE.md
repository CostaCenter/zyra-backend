# 🧪 Guía de Pruebas - CRUD Complejos + Auth

## 📋 Flujo de Prueba Completo

Esta guía te ayudará a probar todo el sistema paso a paso usando Postman, Thunder Client o cURL.

---

## 🔐 PASO 1: Registrar Usuario

**POST** `http://localhost:3000/auth/register`

**Body (JSON):**
```json
{
  "telefono": "+573001234567",
  "password": "password123",
  "nick": "jorge_dueno",
  "name": "Jorge López",
  "role": "DUEÑO"
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "id": 1,
    "telefono": "+573001234567",
    "nick": "jorge_dueno",
    "name": "Jorge López",
    "role": "DUEÑO",
    "status": "ACTIVO"
  }
}
```

---

## 🔑 PASO 2: Hacer Login

**POST** `http://localhost:3000/auth/login`

**Body (JSON):**
```json
{
  "telefono": "+573001234567",
  "password": "password123"
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidGVsZWZvbm8iOiIrNTczMDAxMjM0NTY3...",
    "user": {
      "id": 1,
      "telefono": "+573001234567",
      "nick": "jorge_dueno",
      "name": "Jorge López",
      "role": "DUEÑO",
      "status": "ACTIVO"
    }
  }
}
```

**⚠️ IMPORTANTE:** Guarda el `token` de la respuesta. Lo necesitarás para los siguientes pasos.

---

## 🏟️ PASO 3: Crear un Complejo

**POST** `http://localhost:3000/api/complexes`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "nombre": "Complejo Deportivo La Victoria",
  "ubicacion": "Cali, Valle del Cauca",
  "photo": "https://ejemplo.com/complejo-victoria.jpg",
  "wallpaper": "https://ejemplo.com/wallpaper-victoria.jpg"
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Complejo creado exitosamente",
  "data": {
    "id": 1,
    "nombre": "Complejo Deportivo La Victoria",
    "ubicacion": "Cali, Valle del Cauca",
    "dueño_id": 1,
    "photo": "https://ejemplo.com/complejo-victoria.jpg",
    "wallpaper": "https://ejemplo.com/wallpaper-victoria.jpg"
  }
}
```

---

## 🏟️ PASO 4: Crear Otro Complejo

**POST** `http://localhost:3000/api/complexes`

**Headers:**
```
Authorization: Bearer tu_token_aqui
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "nombre": "Canchas El Estadio",
  "ubicacion": "Jamundí, Valle del Cauca",
  "photo": "https://ejemplo.com/estadio.jpg"
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Complejo creado exitosamente",
  "data": {
    "id": 2,
    "nombre": "Canchas El Estadio",
    "ubicacion": "Jamundí, Valle del Cauca",
    "dueño_id": 1,
    "photo": "https://ejemplo.com/estadio.jpg",
    "wallpaper": null
  }
}
```

---

## 📋 PASO 5: Ver Mis Complejos (Jorge)

**GET** `http://localhost:3000/api/complexes/my-complexes`

**Headers:**
```
Authorization: Bearer tu_token_aqui
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Complejos del usuario",
  "data": [
    {
      "id": 2,
      "nombre": "Canchas El Estadio",
      "ubicacion": "Jamundí, Valle del Cauca",
      "dueño_id": 1,
      "photo": "https://ejemplo.com/estadio.jpg",
      "wallpaper": null,
      "dueño": {
        "id": 1,
        "name": "Jorge López",
        "nick": "jorge_dueno",
        "telefono": "+573001234567",
        "photo": null
      }
    },
    {
      "id": 1,
      "nombre": "Complejo Deportivo La Victoria",
      "ubicacion": "Cali, Valle del Cauca",
      "dueño_id": 1,
      "photo": "https://ejemplo.com/complejo-victoria.jpg",
      "wallpaper": "https://ejemplo.com/wallpaper-victoria.jpg",
      "dueño": {
        "id": 1,
        "name": "Jorge López",
        "nick": "jorge_dueno",
        "telefono": "+573001234567",
        "photo": null
      }
    }
  ],
  "count": 2
}
```

---

## 🌍 PASO 6: Ver Todos los Complejos (Público)

**GET** `http://localhost:3000/api/complexes`

**Headers:** (ninguno necesario)

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Lista de complejos",
  "data": [
    {
      "id": 2,
      "nombre": "Canchas El Estadio",
      "ubicacion": "Jamundí, Valle del Cauca",
      "dueño_id": 1,
      "photo": "https://ejemplo.com/estadio.jpg",
      "wallpaper": null,
      "dueño": {
        "id": 1,
        "name": "Jorge López",
        "nick": "jorge_dueno",
        "photo": null
      }
    },
    {
      "id": 1,
      "nombre": "Complejo Deportivo La Victoria",
      "ubicacion": "Cali, Valle del Cauca",
      "dueño_id": 1,
      "photo": "https://ejemplo.com/complejo-victoria.jpg",
      "wallpaper": "https://ejemplo.com/wallpaper-victoria.jpg",
      "dueño": {
        "id": 1,
        "name": "Jorge López",
        "nick": "jorge_dueno",
        "photo": null
      }
    }
  ],
  "count": 2
}
```

---

## 🔍 PASO 7: Ver Detalle de un Complejo

**GET** `http://localhost:3000/api/complexes/1`

**Headers:** (ninguno necesario)

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Complejo encontrado",
  "data": {
    "id": 1,
    "nombre": "Complejo Deportivo La Victoria",
    "ubicacion": "Cali, Valle del Cauca",
    "dueño_id": 1,
    "photo": "https://ejemplo.com/complejo-victoria.jpg",
    "wallpaper": "https://ejemplo.com/wallpaper-victoria.jpg",
    "dueño": {
      "id": 1,
      "name": "Jorge López",
      "nick": "jorge_dueno",
      "telefono": "+573001234567",
      "photo": null
    }
  }
}
```

---

## ✏️ PASO 8: Actualizar un Complejo

**PUT** `http://localhost:3000/api/complexes/1`

**Headers:**
```
Authorization: Bearer tu_token_aqui
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "nombre": "Complejo Deportivo La Victoria - RENOVADO",
  "ubicacion": "Cali, Colombia",
  "wallpaper": "https://ejemplo.com/nuevo-wallpaper.jpg"
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Complejo actualizado exitosamente",
  "data": {
    "id": 1,
    "nombre": "Complejo Deportivo La Victoria - RENOVADO",
    "ubicacion": "Cali, Colombia",
    "dueño_id": 1,
    "photo": "https://ejemplo.com/complejo-victoria.jpg",
    "wallpaper": "https://ejemplo.com/nuevo-wallpaper.jpg"
  }
}
```

---

## 🗑️ PASO 9: Eliminar un Complejo

**DELETE** `http://localhost:3000/api/complexes/2`

**Headers:**
```
Authorization: Bearer tu_token_aqui
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Complejo eliminado exitosamente"
}
```

---

## ❌ PASO 10: Probar Sin Autenticación (Debe Fallar)

**POST** `http://localhost:3000/api/complexes`

**Headers:** (sin Authorization)

**Body (JSON):**
```json
{
  "nombre": "Complejo Sin Auth"
}
```

**Respuesta Esperada (401):**
```json
{
  "success": false,
  "message": "No se proporcionó token de autenticación"
}
```

---

## ❌ PASO 11: Probar Editar Complejo de Otro Usuario (Debe Fallar)

1. Registra un segundo usuario:

**POST** `http://localhost:3000/auth/register`
```json
{
  "telefono": "+573009876543",
  "password": "password456",
  "nick": "maria_admin",
  "name": "María García"
}
```

2. Haz login con el segundo usuario y guarda su token

3. Intenta editar el complejo del primer usuario:

**PUT** `http://localhost:3000/api/complexes/1`

**Headers:**
```
Authorization: Bearer token_de_maria
Content-Type: application/json
```

**Body:**
```json
{
  "nombre": "Intentando Editar"
}
```

**Respuesta Esperada (403):**
```json
{
  "success": false,
  "message": "No tienes permiso para editar este complejo"
}
```

---

## 🧪 Checklist de Pruebas

### Autenticación:
- [ ] Registrar usuario nuevo
- [ ] Hacer login y obtener token
- [ ] Verificar usuario con GET /auth/me

### Complejos - CRUD Básico:
- [ ] Crear complejo con token válido
- [ ] Crear otro complejo
- [ ] Ver mis complejos (solo los míos)
- [ ] Ver todos los complejos (público)
- [ ] Ver detalle de un complejo específico
- [ ] Actualizar mi complejo
- [ ] Eliminar mi complejo

### Validaciones y Seguridad:
- [ ] Intentar crear complejo sin token (debe fallar)
- [ ] Intentar crear complejo sin nombre (debe fallar)
- [ ] Intentar editar complejo de otro usuario (debe fallar)
- [ ] Intentar eliminar complejo de otro usuario (debe fallar)
- [ ] Usar token expirado (debe fallar)
- [ ] Usar token inválido (debe fallar)

---

## 🛠️ Configuración en Postman

### 1. Crear Entorno (Environment)

**Variables:**
```
base_url: http://localhost:3000
token: (se llenará automáticamente)
```

### 2. Script Post-Response para Login

En la petición de login, agrega este script en "Tests":

```javascript
const response = pm.response.json();
if (response.success && response.data.token) {
    pm.environment.set("token", response.data.token);
    console.log("Token guardado:", response.data.token);
}
```

### 3. Usar Variables en las Peticiones

**URL:** `{{base_url}}/api/complexes`

**Header Authorization:** `Bearer {{token}}`

---

## 🛠️ Configuración en Thunder Client (VS Code)

### 1. Crear Environment

```json
{
  "name": "Zyra Local",
  "variables": [
    {
      "name": "base_url",
      "value": "http://localhost:3000"
    },
    {
      "name": "token",
      "value": ""
    }
  ]
}
```

### 2. En cada request protegido

**Headers:**
```
Authorization: Bearer {{token}}
```

---

## 📝 Notas Importantes

1. **Token JWT:** Expira en 7 días. Si expira, haz login nuevamente.

2. **Base de datos:** Si usas `sequelize.sync({ force: true })`, se borrarán todos los datos al reiniciar el servidor.

3. **Variables de entorno:** Asegúrate de tener `JWT_SECRET` en tu archivo `.env`

4. **Puerto:** Por defecto es 3000, pero verifica tu configuración.

---

## 🚀 Scripts de Prueba Rápida (cURL)

```bash
# 1. Registrar
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"telefono":"+573001234567","password":"pass123","nick":"jorge","name":"Jorge"}'

# 2. Login (guarda el token)
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"telefono":"+573001234567","password":"pass123"}' | jq -r '.data.token')

# 3. Crear complejo
curl -X POST http://localhost:3000/api/complexes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Mi Complejo","ubicacion":"Cali"}'

# 4. Ver mis complejos
curl -X GET http://localhost:3000/api/complexes/my-complexes \
  -H "Authorization: Bearer $TOKEN"

# 5. Ver todos los complejos (público)
curl -X GET http://localhost:3000/api/complexes
```

---

## ✅ Todo Listo

Con esta guía puedes probar completamente el sistema de autenticación y CRUD de complejos. ¡Empieza desde el PASO 1 y sigue en orden! 🎉
