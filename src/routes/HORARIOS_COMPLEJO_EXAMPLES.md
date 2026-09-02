# Endpoints de Horarios de Complejos - Zyra

Documentación de los endpoints para gestionar los horarios de apertura y cierre de complejos deportivos.

## Índice
- [Configurar Horarios Personalizados](#1-configurar-horarios-personalizados)
- [Configurar Horario Estándar](#2-configurar-horario-estándar)
- [Obtener Horarios](#3-obtener-horarios)
- [Actualizar Estado de un Día](#4-actualizar-estado-de-un-día)
- [Eliminar Horarios](#5-eliminar-horarios)

---

## 1. Configurar Horarios Personalizados

Configura horarios específicos para cada día de la semana de forma personalizada.

**Endpoint:** `POST /api/complexes/:id/horarios`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID del complejo

**Body (JSON):**
```json
{
  "horarios": [
    {
      "dia_semana": 1,
      "hora_apertura": "08:00",
      "hora_cierre": "22:00"
    },
    {
      "dia_semana": 2,
      "hora_apertura": "08:00",
      "hora_cierre": "22:00"
    },
    {
      "dia_semana": 3,
      "hora_apertura": "08:00",
      "hora_cierre": "22:00"
    },
    {
      "dia_semana": 4,
      "hora_apertura": "08:00",
      "hora_cierre": "22:00"
    },
    {
      "dia_semana": 5,
      "hora_apertura": "08:00",
      "hora_cierre": "23:00"
    },
    {
      "dia_semana": 6,
      "hora_apertura": "09:00",
      "hora_cierre": "23:00"
    },
    {
      "dia_semana": 0,
      "hora_apertura": "10:00",
      "hora_cierre": "20:00"
    }
  ]
}
```

**Nota sobre `dia_semana`:**
- `0` = Domingo
- `1` = Lunes
- `2` = Martes
- `3` = Miércoles
- `4` = Jueves
- `5` = Viernes
- `6` = Sábado

**Formato de hora:**
- Debe ser en formato 24 horas: `HH:MM`
- Ejemplos válidos: `08:00`, `14:30`, `23:45`

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Horarios configurados exitosamente",
  "data": {
    "complejo_id": 1,
    "horarios": [
      {
        "dia_numero": 0,
        "dia_nombre": "Domingo",
        "hora_apertura": "10:00:00",
        "hora_cierre": "20:00:00",
        "esta_cerrado": false
      },
      {
        "dia_numero": 1,
        "dia_nombre": "Lunes",
        "hora_apertura": "08:00:00",
        "hora_cierre": "22:00:00",
        "esta_cerrado": false
      }
      // ... resto de días
    ]
  }
}
```

**Errores posibles:**
- `400` - Formato de horarios inválido
- `403` - No tienes permiso para configurar este complejo
- `404` - Complejo no encontrado

---

## 2. Configurar Horario Estándar

Configura rápidamente horarios estándar: un horario para Lunes-Viernes, otro para Sábado y otro para Domingo.

**Endpoint:** `POST /api/complexes/:id/horarios/estandar`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID del complejo

**Body (JSON):**
```json
{
  "lun_vie_apertura": "08:00",
  "lun_vie_cierre": "22:00",
  "sab_apertura": "09:00",
  "sab_cierre": "23:00",
  "dom_apertura": "10:00",
  "dom_cierre": "20:00"
}
```

**Descripción de campos:**
- `lun_vie_apertura`: Hora de apertura de Lunes a Viernes
- `lun_vie_cierre`: Hora de cierre de Lunes a Viernes
- `sab_apertura`: Hora de apertura del Sábado
- `sab_cierre`: Hora de cierre del Sábado
- `dom_apertura`: Hora de apertura del Domingo
- `dom_cierre`: Hora de cierre del Domingo

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Horario estándar configurado exitosamente",
  "data": {
    "complejo_id": 1,
    "horarios": [
      {
        "dia_numero": 0,
        "dia_nombre": "Domingo",
        "hora_apertura": "10:00:00",
        "hora_cierre": "20:00:00",
        "esta_cerrado": false
      },
      {
        "dia_numero": 1,
        "dia_nombre": "Lunes",
        "hora_apertura": "08:00:00",
        "hora_cierre": "22:00:00",
        "esta_cerrado": false
      }
      // ... se crean automáticamente todos los días
    ]
  }
}
```

**Errores posibles:**
- `400` - Formato de horarios inválido o campos faltantes
- `403` - No tienes permiso para configurar este complejo
- `404` - Complejo no encontrado

---

## 3. Obtener Horarios

Consulta los horarios configurados de un complejo (endpoint público).

**Endpoint:** `GET /api/complexes/:id/horarios`

**Autenticación:** No requerida (público)

**Parámetros URL:**
- `id` (number) - ID del complejo

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Horarios del complejo",
  "data": {
    "complejo_id": 1,
    "complejo_nombre": "Complejo Deportivo Los Andes",
    "horarios": [
      {
        "dia_numero": 0,
        "dia_nombre": "Domingo",
        "hora_apertura": "10:00:00",
        "hora_cierre": "20:00:00",
        "esta_cerrado": false
      },
      {
        "dia_numero": 1,
        "dia_nombre": "Lunes",
        "hora_apertura": "08:00:00",
        "hora_cierre": "22:00:00",
        "esta_cerrado": false
      },
      {
        "dia_numero": 2,
        "dia_nombre": "Martes",
        "hora_apertura": "08:00:00",
        "hora_cierre": "22:00:00",
        "esta_cerrado": false
      },
      {
        "dia_numero": 3,
        "dia_nombre": "Miércoles",
        "hora_apertura": "08:00:00",
        "hora_cierre": "22:00:00",
        "esta_cerrado": false
      },
      {
        "dia_numero": 4,
        "dia_nombre": "Jueves",
        "hora_apertura": "08:00:00",
        "hora_cierre": "22:00:00",
        "esta_cerrado": false
      },
      {
        "dia_numero": 5,
        "dia_nombre": "Viernes",
        "hora_apertura": "08:00:00",
        "hora_cierre": "22:00:00",
        "esta_cerrado": false
      },
      {
        "dia_numero": 6,
        "dia_nombre": "Sábado",
        "hora_apertura": "09:00:00",
        "hora_cierre": "23:00:00",
        "esta_cerrado": false
      }
    ]
  }
}
```

**Errores posibles:**
- `404` - Complejo no encontrado

---

## 4. Actualizar Estado de un Día

Marca un día específico como cerrado (por ejemplo, para festivos o mantenimiento) o volver a abrirlo.

**Endpoint:** `PATCH /api/complexes/:id/horarios/:dia`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID del complejo
- `dia` (number) - Día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)

**Body (JSON):**
```json
{
  "esta_cerrado": true
}
```

**Casos de uso:**
- Marcar un día como cerrado por festivo nacional
- Cerrar temporalmente por mantenimiento
- Reabrir después de un cierre temporal

**Ejemplo: Cerrar el complejo los domingos**

`PATCH /api/complexes/1/horarios/0`

```json
{
  "esta_cerrado": true
}
```

**Ejemplo: Reabrir los domingos**

`PATCH /api/complexes/1/horarios/0`

```json
{
  "esta_cerrado": false
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Día marcado como cerrado exitosamente",
  "data": {
    "complejo_id": 1,
    "dia_actualizado": 0,
    "esta_cerrado": true,
    "horarios": [
      {
        "dia_numero": 0,
        "dia_nombre": "Domingo",
        "hora_apertura": "10:00:00",
        "hora_cierre": "20:00:00",
        "esta_cerrado": true
      }
      // ... resto de días
    ]
  }
}
```

**Errores posibles:**
- `400` - Día inválido o formato incorrecto
- `403` - No tienes permiso para configurar este complejo
- `404` - Complejo no encontrado o día sin horario configurado

---

## 5. Eliminar Horarios

Elimina todos los horarios configurados de un complejo (útil para reconfigurar desde cero).

**Endpoint:** `DELETE /api/complexes/:id/horarios`

**Autenticación:** Requerida (Bearer Token) - Solo el dueño del complejo

**Parámetros URL:**
- `id` (number) - ID del complejo

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Horarios eliminados exitosamente",
  "data": {
    "complejo_id": 1,
    "horarios_eliminados": 7
  }
}
```

**Errores posibles:**
- `403` - No tienes permiso para configurar este complejo
- `404` - Complejo no encontrado

---

## Flujo de Trabajo Recomendado

### Para configurar un complejo nuevo:

1. **Crear el complejo** (POST `/api/complexes`)
2. **Configurar horario estándar** (POST `/api/complexes/:id/horarios/estandar`)
3. Si necesitas ajustar días específicos, usa **configuración personalizada** (POST `/api/complexes/:id/horarios`)
4. Para cerrar temporalmente un día, usa **actualizar estado** (PATCH `/api/complexes/:id/horarios/:dia`)

### Para modificar horarios existentes:

**Opción A: Modificación completa**
1. Eliminar horarios actuales (DELETE `/api/complexes/:id/horarios`)
2. Configurar nuevos horarios (POST con los nuevos valores)

**Opción B: Modificación de días específicos**
1. Enviar POST con solo los días que quieres modificar
2. El sistema actualizará solo esos días (usa `updateOnDuplicate`)

---

## Notas Importantes

1. **Formato de hora**: Siempre usa formato 24 horas (HH:MM)
2. **Días de la semana**: 0 = Domingo, 1-6 = Lunes a Sábado
3. **Actualización vs Creación**: El endpoint POST usa `bulkCreate` con `updateOnDuplicate`, lo que significa que si un día ya existe, lo actualiza
4. **Permisos**: Solo el dueño del complejo puede configurar horarios
5. **Consulta pública**: Cualquiera puede consultar los horarios (GET es público)
6. **Cierre temporal**: Usa `esta_cerrado: true` para festivos o mantenimiento sin eliminar el horario

---

## Ejemplos de Uso con cURL

### Configurar horario estándar

```bash
curl -X POST http://localhost:3000/api/complexes/1/horarios/estandar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "lun_vie_apertura": "08:00",
    "lun_vie_cierre": "22:00",
    "sab_apertura": "09:00",
    "sab_cierre": "23:00",
    "dom_apertura": "10:00",
    "dom_cierre": "20:00"
  }'
```

### Obtener horarios (público)

```bash
curl -X GET http://localhost:3000/api/complexes/1/horarios
```

### Cerrar el complejo los domingos

```bash
curl -X PATCH http://localhost:3000/api/complexes/1/horarios/0 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "esta_cerrado": true
  }'
```

### Eliminar todos los horarios

```bash
curl -X DELETE http://localhost:3000/api/complexes/1/horarios \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

---

## Integración con el Frontend

### React/JavaScript Example

```javascript
// Configurar horario estándar
const configurarHorarioEstandar = async (complexId, token) => {
  const response = await fetch(`/api/complexes/${complexId}/horarios/estandar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      lun_vie_apertura: '08:00',
      lun_vie_cierre: '22:00',
      sab_apertura: '09:00',
      sab_cierre: '23:00',
      dom_apertura: '10:00',
      dom_cierre: '20:00'
    })
  });
  
  return await response.json();
};

// Obtener horarios (público)
const obtenerHorarios = async (complexId) => {
  const response = await fetch(`/api/complexes/${complexId}/horarios`);
  return await response.json();
};

// Marcar domingo como cerrado
const cerrarDomingo = async (complexId, token) => {
  const response = await fetch(`/api/complexes/${complexId}/horarios/0`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      esta_cerrado: true
    })
  });
  
  return await response.json();
};
```
