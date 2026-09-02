# 🏟️ API de Canchas - Zyra Backend

Documentación completa del módulo de gestión de **Canchas** (hijas de Complejos).

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Endpoints](#-endpoints)
- [Ejemplos de Uso](#-ejemplos-de-uso)
- [Seguridad](#-seguridad)
- [Validaciones](#-validaciones)

## 🎯 Descripción

El módulo de Canchas permite gestionar las canchas deportivas que pertenecen a un complejo. Solo el **dueño del complejo** puede crear, editar o eliminar canchas en su complejo.

## 🔌 Endpoints

| Método | Endpoint | Descripción | Protegido |
|--------|----------|-------------|-----------|
| POST | `/api/courts` | Crear nueva cancha | ✅ Sí (Dueño del complejo) |
| GET | `/api/courts/complex/:complexId` | Listar canchas de un complejo | ❌ No |
| GET | `/api/courts/:id` | Obtener cancha por ID | ❌ No |
| PUT | `/api/courts/:id` | Actualizar cancha | ✅ Sí (Dueño del complejo) |
| DELETE | `/api/courts/:id` | Eliminar cancha | ✅ Sí (Dueño del complejo) |

---

## 📝 Ejemplos de Uso

### 1. Crear Cancha

**POST** `/api/courts`

**Headers:**
```
Authorization: Bearer <tu_token_jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "complejo_id": 1,
  "nombre": "Cancha de Fútbol 5 - Principal",
  "tipo_deporte": "Fútbol",
  "sport_id": 1,
  "precio_hora": 50000,
  "state": "DISPONIBLE",
  "photo": "https://ejemplo.com/foto-cancha.jpg"
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "message": "Cancha creada exitosamente",
  "data": {
    "id": 1,
    "complejo_id": 1,
    "nombre": "Cancha de Fútbol 5 - Principal",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": "50000.00",
    "state": "DISPONIBLE",
    "photo": "https://ejemplo.com/foto-cancha.jpg",
    "complejo": {
      "id": 1,
      "nombre": "Complejo Deportivo El Campeón",
      "ubicacion": "Cali"
    },
    "sport": {
      "id": 1,
      "name": "Fútbol"
    }
  }
}
```

**Errores Posibles:**
- **400 Bad Request**: Faltan campos obligatorios
- **403 Forbidden**: No eres el dueño del complejo
- **404 Not Found**: Complejo o deporte no encontrado

---

### 2. Obtener Canchas de un Complejo

**GET** `/api/courts/complex/:complexId`

**Ejemplo:** `/api/courts/complex/1`

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Canchas del complejo",
  "count": 3,
  "data": [
    {
      "id": 1,
      "complejo_id": 1,
      "nombre": "Cancha de Fútbol 5 - Principal",
      "tipo_deporte": "Fútbol",
      "sport_id": 1,
      "precio_hora": "50000.00",
      "state": "DISPONIBLE",
      "photo": "https://ejemplo.com/foto-cancha.jpg",
      "complejo": {
        "id": 1,
        "nombre": "Complejo Deportivo El Campeón",
        "ubicacion": "Cali"
      },
      "sport": {
        "id": 1,
        "name": "Fútbol"
      }
    },
    {
      "id": 2,
      "complejo_id": 1,
      "nombre": "Cancha de Fútbol 5 - Secundaria",
      "tipo_deporte": "Fútbol",
      "sport_id": 1,
      "precio_hora": "45000.00",
      "state": "DISPONIBLE",
      "photo": null,
      "complejo": {
        "id": 1,
        "nombre": "Complejo Deportivo El Campeón",
        "ubicacion": "Cali"
      },
      "sport": {
        "id": 1,
        "name": "Fútbol"
      }
    }
  ]
}
```

---

### 3. Obtener Cancha por ID

**GET** `/api/courts/:id`

**Ejemplo:** `/api/courts/1`

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Cancha encontrada",
  "data": {
    "id": 1,
    "complejo_id": 1,
    "nombre": "Cancha de Fútbol 5 - Principal",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": "50000.00",
    "state": "DISPONIBLE",
    "photo": "https://ejemplo.com/foto-cancha.jpg",
    "complejo": {
      "id": 1,
      "nombre": "Complejo Deportivo El Campeón",
      "ubicacion": "Cali",
      "dueño_id": 5
    },
    "sport": {
      "id": 1,
      "name": "Fútbol"
    }
  }
}
```

---

### 4. Actualizar Cancha

**PUT** `/api/courts/:id`

**Headers:**
```
Authorization: Bearer <tu_token_jwt>
Content-Type: application/json
```

**Body (todos los campos son opcionales):**
```json
{
  "nombre": "Cancha de Fútbol 5 - VIP",
  "precio_hora": 60000,
  "state": "MANTENIMIENTO"
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Cancha actualizada exitosamente",
  "data": {
    "id": 1,
    "complejo_id": 1,
    "nombre": "Cancha de Fútbol 5 - VIP",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": "60000.00",
    "state": "MANTENIMIENTO",
    "photo": "https://ejemplo.com/foto-cancha.jpg",
    "complejo": {
      "id": 1,
      "nombre": "Complejo Deportivo El Campeón",
      "ubicacion": "Cali"
    },
    "sport": {
      "id": 1,
      "name": "Fútbol"
    }
  }
}
```

**Errores Posibles:**
- **403 Forbidden**: No eres el dueño del complejo
- **404 Not Found**: Cancha no encontrada

---

### 5. Eliminar Cancha

**DELETE** `/api/courts/:id`

**Headers:**
```
Authorization: Bearer <tu_token_jwt>
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Cancha eliminada exitosamente"
}
```

**Errores Posibles:**
- **403 Forbidden**: No eres el dueño del complejo
- **404 Not Found**: Cancha no encontrada

---

## 🔒 Seguridad

### Protección de Dueños

El sistema implementa una **verificación estricta de propiedad**:

1. **Al crear una cancha**: Se verifica que el `complejo_id` proporcionado pertenezca al usuario autenticado (dueño del token).

2. **Al actualizar/eliminar**: Se verifica que el complejo asociado a la cancha pertenezca al usuario autenticado.

**Ejemplo de error si intentas crear una cancha en un complejo ajeno:**
```json
{
  "success": false,
  "message": "No tienes permiso para crear canchas en este complejo. Solo el dueño puede hacerlo."
}
```

### Rutas Protegidas

Las siguientes rutas requieren autenticación con JWT:
- `POST /api/courts`
- `PUT /api/courts/:id`
- `DELETE /api/courts/:id`

Las rutas de consulta (GET) son públicas para que los usuarios puedan ver las canchas disponibles.

---

## ✅ Validaciones

### Campos Obligatorios al Crear

- `complejo_id` (número): ID del complejo al que pertenece la cancha
- `nombre` (string): Nombre descriptivo de la cancha

### Campos Opcionales

- `tipo_deporte` (string): Tipo de deporte ("Fútbol", "Voley", etc.)
- `sport_id` (número): ID del deporte en la tabla `sports`
- `precio_hora` (decimal): Precio por hora de alquiler
- `state` (string): Estado de la cancha (valores: DISPONIBLE, OCUPADA, MANTENIMIENTO, FUERA DE SERVICIO)
- `photo` (text): URL de la foto de la cancha

### Validaciones de Negocio

1. **Complejo existe**: Verifica que el `complejo_id` exista en la base de datos
2. **Deporte existe**: Si se proporciona `sport_id`, verifica que exista
3. **Propiedad del complejo**: El usuario debe ser el dueño del complejo
4. **Estado válido**: El `state` debe ser uno de los valores permitidos

---

## 🏗️ Estructura de Archivos

```
src/
├── services/
│   └── courtService.js        ← Lógica de negocio
├── controllers/
│   └── courtController.js     ← Handlers HTTP
├── routes/
│   └── courtRoutes.js         ← Definición de rutas
└── app.js                     ← Registro de rutas (/api/courts)
```

---

## 🧪 Probar con cURL

### Crear Cancha
```bash
curl -X POST http://localhost:3000/api/courts \
-H "Authorization: Bearer TU_TOKEN_AQUI" \
-H "Content-Type: application/json" \
-d '{
  "complejo_id": 1,
  "nombre": "Cancha de Fútbol 5",
  "tipo_deporte": "Fútbol",
  "sport_id": 1,
  "precio_hora": 50000,
  "state": "DISPONIBLE"
}'
```

### Listar Canchas de un Complejo
```bash
curl http://localhost:3000/api/courts/complex/1
```

### Obtener Cancha por ID
```bash
curl http://localhost:3000/api/courts/1
```

### Actualizar Cancha
```bash
curl -X PUT http://localhost:3000/api/courts/1 \
-H "Authorization: Bearer TU_TOKEN_AQUI" \
-H "Content-Type: application/json" \
-d '{
  "precio_hora": 60000,
  "state": "MANTENIMIENTO"
}'
```

### Eliminar Cancha
```bash
curl -X DELETE http://localhost:3000/api/courts/1 \
-H "Authorization: Bearer TU_TOKEN_AQUI"
```

---

## 🎓 Notas Importantes

1. **Relaciones**: Las canchas siempre están vinculadas a un complejo y opcionalmente a un deporte.

2. **Cascada**: Si eliminas un complejo, considera lo que sucede con sus canchas (configurar en el modelo).

3. **Estados de Cancha**: 
   - `DISPONIBLE`: Lista para reservas
   - `OCUPADA`: En uso actualmente
   - `MANTENIMIENTO`: No disponible temporalmente
   - `FUERA DE SERVICIO`: Deshabilitada

4. **Estándar ESM**: Todos los archivos usan `import/export` de ES6.

---

## ✨ Características Implementadas

- ✅ CRUD completo de canchas
- ✅ Protección de dueños (solo pueden crear/editar sus canchas)
- ✅ Relaciones con Complejos y Deportes
- ✅ Validaciones de negocio
- ✅ Mensajes de error descriptivos
- ✅ Rutas públicas para consultas
- ✅ Rutas protegidas para modificaciones
- ✅ Estándar ESM (.js)

---

**¡Las canchas están listas para usar! 🚀**
