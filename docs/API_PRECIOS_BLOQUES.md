# API de Precios por Bloques - Zyra

Este documento describe el funcionamiento del endpoint independiente para la gestión de precios de canchas usando el **sistema de bloques lógicos**.

---

## 📋 Tabla de Contenidos

- [Introducción](#introducción)
- [Concepto de "Bloque"](#concepto-de-bloque)
- [Endpoints Disponibles](#endpoints-disponibles)
- [GET - Obtener Precios Agrupados](#get---obtener-precios-agrupados)
- [PUT - Guardar Configuración](#put---guardar-configuración)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Códigos de Error](#códigos-de-error)

---

## Introducción

El sistema de precios por bloques permite agrupar varios días que comparten las mismas franjas horarias y precios, simplificando la configuración desde el frontend.

### Modelo de Datos

- **Base de Datos**: Los precios se almacenan de forma **plana** (un registro por cada combinación de día + franja horaria).
- **Frontend**: Los precios se visualizan y editan como **bloques** (agrupaciones lógicas de días con franjas idénticas).

---

## Concepto de "Bloque"

Un **bloque** es una agrupación de días que tienen **exactamente** las mismas franjas horarias con los mismos precios.

### Ejemplo

Si Lunes, Martes y Miércoles tienen estas franjas:
- 08:00 - 18:00 → $50,000
- 18:00 - 22:00 → $80,000

Y Jueves y Viernes tienen esas **mismas** franjas, entonces todos estos días pertenecen al **mismo bloque**.

```json
{
  "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
  "horarios": [
    { "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 50000 },
    { "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 80000 }
  ]
}
```

---

## Endpoints Disponibles

### Base URL

```
/api/canchas/:id/precios
```

| Método | Ruta | Descripción | Autenticación |
|--------|------|-------------|---------------|
| GET | `/api/canchas/:id/precios` | Obtener precios agrupados en bloques | No requerida |
| PUT | `/api/canchas/:id/precios` | Guardar configuración completa de bloques | Requerida (Token) |

---

## GET - Obtener Precios Agrupados

### Descripción

Obtiene todos los precios de una cancha y los agrupa automáticamente en bloques lógicos.

### Request

```http
GET /api/canchas/1/precios
```

### Response Exitoso (200)

```json
{
  "success": true,
  "message": "Precios obtenidos y agrupados exitosamente",
  "data": {
    "cancha_id": 1,
    "bloques": [
      {
        "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
        "horarios": [
          {
            "hora_inicio": "08:00",
            "hora_fin": "18:00",
            "precio_hora": 50000
          },
          {
            "hora_inicio": "18:00",
            "hora_fin": "22:00",
            "precio_hora": 80000
          }
        ]
      },
      {
        "dias": ["Sá", "Do"],
        "horarios": [
          {
            "hora_inicio": "09:00",
            "hora_fin": "22:00",
            "precio_hora": 90000
          }
        ]
      },
      {
        "dias": ["Fes"],
        "horarios": [
          {
            "hora_inicio": "08:00",
            "hora_fin": "23:00",
            "precio_hora": 120000
          }
        ]
      }
    ]
  }
}
```

### Response Sin Configuración (200)

```json
{
  "success": true,
  "message": "No hay precios configurados para esta cancha",
  "data": {
    "cancha_id": 1,
    "bloques": []
  }
}
```

### Response de Error (404)

```json
{
  "success": false,
  "message": "Cancha no encontrada"
}
```

---

## PUT - Guardar Configuración

### Descripción

Guarda una configuración completa de precios por bloques. Esta operación:

1. **Elimina** todos los precios existentes de la cancha
2. **Aplana** los bloques recibidos en registros individuales
3. **Inserta** los nuevos registros en la base de datos

Todo se ejecuta dentro de una **transacción** para garantizar consistencia.

### Request

```http
PUT /api/canchas/1/precios
Authorization: Bearer <token>
Content-Type: application/json
```

### Body

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
      "horarios": [
        {
          "hora_inicio": "08:00",
          "hora_fin": "18:00",
          "precio_hora": 50000
        },
        {
          "hora_inicio": "18:00",
          "hora_fin": "22:00",
          "precio_hora": 80000
        }
      ]
    },
    {
      "dias": ["Sá", "Do", "Fes"],
      "horarios": [
        {
          "hora_inicio": "09:00",
          "hora_fin": "22:00",
          "precio_hora": 90000
        }
      ]
    }
  ]
}
```

### Response Exitoso (200)

```json
{
  "success": true,
  "message": "Precios configurados exitosamente",
  "data": {
    "cancha_id": 1,
    "cancha_nombre": "Cancha Fútbol 5",
    "bloques_recibidos": 2,
    "registros_creados": 18
  }
}
```

**Explicación del cálculo:**
- Bloque 1: 5 días × 2 franjas = 10 registros
- Bloque 2: 3 días × 1 franja = 3 registros
- **Total**: 13 registros creados en la BD

### Validaciones del Body

El endpoint valida exhaustivamente el body recibido:

#### Estructura General

```javascript
// Debe ser un array
{
  "bloques": [...] // REQUERIDO, debe ser array
}
```

#### Estructura de Cada Bloque

```javascript
{
  "dias": ["Lu", "Ma", ...],  // REQUERIDO, array con al menos 1 día
  "horarios": [...]            // REQUERIDO, array con al menos 1 franja
}
```

#### Etiquetas de Días Permitidas

| Etiqueta | Significado | Valor en BD |
|----------|-------------|-------------|
| `Lu` | Lunes | 1 |
| `Ma` | Martes | 2 |
| `Mi` | Miércoles | 3 |
| `Ju` | Jueves | 4 |
| `Vi` | Viernes | 5 |
| `Sá` | Sábado | 6 |
| `Do` | Domingo | 0 |
| `Fes` | Festivo | 7 |

#### Estructura de Cada Franja Horaria

```javascript
{
  "hora_inicio": "08:00",  // REQUERIDO, formato HH:MM
  "hora_fin": "18:00",     // REQUERIDO, formato HH:MM
  "precio_hora": 50000     // REQUERIDO, número >= 0
}
```

---

## Ejemplos de Uso

### Ejemplo 1: Configuración Simple (Un solo bloque)

**Request:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"],
      "horarios": [
        {
          "hora_inicio": "08:00",
          "hora_fin": "22:00",
          "precio_hora": 60000
        }
      ]
    }
  ]
}
```

**Resultado:** Todos los días de la semana tienen el mismo precio de $60,000 por hora de 8:00 AM a 10:00 PM.

---

### Ejemplo 2: Diferenciación Semana vs Fin de Semana

**Request:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
      "horarios": [
        {
          "hora_inicio": "08:00",
          "hora_fin": "18:00",
          "precio_hora": 50000
        },
        {
          "hora_inicio": "18:00",
          "hora_fin": "22:00",
          "precio_hora": 70000
        }
      ]
    },
    {
      "dias": ["Sá", "Do"],
      "horarios": [
        {
          "hora_inicio": "08:00",
          "hora_fin": "22:00",
          "precio_hora": 90000
        }
      ]
    }
  ]
}
```

---

### Ejemplo 3: Incluir Días Festivos

**Request:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
      "horarios": [
        {
          "hora_inicio": "08:00",
          "hora_fin": "22:00",
          "precio_hora": 60000
        }
      ]
    },
    {
      "dias": ["Sá", "Do", "Fes"],
      "horarios": [
        {
          "hora_inicio": "08:00",
          "hora_fin": "22:00",
          "precio_hora": 100000
        }
      ]
    }
  ]
}
```

**Resultado:** Los festivos tienen el mismo precio que los fines de semana ($100,000).

---

### Ejemplo 4: Configuración con Múltiples Franjas

**Request:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi", "Ju"],
      "horarios": [
        {
          "hora_inicio": "08:00",
          "hora_fin": "12:00",
          "precio_hora": 40000
        },
        {
          "hora_inicio": "12:00",
          "hora_fin": "18:00",
          "precio_hora": 50000
        },
        {
          "hora_inicio": "18:00",
          "hora_fin": "22:00",
          "precio_hora": 80000
        }
      ]
    },
    {
      "dias": ["Vi"],
      "horarios": [
        {
          "hora_inicio": "08:00",
          "hora_fin": "12:00",
          "precio_hora": 45000
        },
        {
          "hora_inicio": "12:00",
          "hora_fin": "18:00",
          "precio_hora": 60000
        },
        {
          "hora_inicio": "18:00",
          "hora_fin": "23:00",
          "precio_hora": 90000
        }
      ]
    }
  ]
}
```

**Resultado:** Viernes tiene precios diferentes y horario extendido hasta las 11:00 PM.

---

## Códigos de Error

### 400 - Bad Request

#### ID inválido

```json
{
  "success": false,
  "message": "ID de cancha inválido"
}
```

#### Bloques no es un array

```json
{
  "success": false,
  "message": "El campo \"bloques\" debe ser un array"
}
```

#### Bloque sin días

```json
{
  "success": false,
  "message": "Bloque 1: debe contener un array \"dias\" con al menos un día"
}
```

#### Etiqueta de día inválida

```json
{
  "success": false,
  "message": "Bloque 1: etiqueta de día \"Lun\" no es válida. Valores permitidos: Lu, Ma, Mi, Ju, Vi, Sá, Do, Fes"
}
```

#### Formato de hora inválido

```json
{
  "success": false,
  "message": "Bloque 1, Franja 1: \"hora_inicio\" debe estar en formato HH:MM (24 horas)"
}
```

#### Precio inválido

```json
{
  "success": false,
  "message": "Bloque 1, Franja 2: \"precio_hora\" debe ser un número mayor o igual a 0"
}
```

---

### 403 - Forbidden

```json
{
  "success": false,
  "message": "No tienes permiso para configurar precios de esta cancha"
}
```

---

### 404 - Not Found

```json
{
  "success": false,
  "message": "Cancha no encontrada"
}
```

---

### 500 - Internal Server Error

```json
{
  "success": false,
  "message": "Error al configurar precios",
  "error": "Descripción del error técnico"
}
```

---

## Algoritmo de Agrupación (GET)

El algoritmo de agrupación funciona de la siguiente manera:

1. **Obtener registros planos** de la BD ordenados por `tipo_dia` y `hora_inicio`

2. **Agrupar por día**: Crear un objeto con todas las franjas de cada día

3. **Generar firma única**: Para cada día, crear un hash JSON de sus franjas horarias ordenadas

4. **Agrupar por firma**: Los días con la misma firma se agrupan en el mismo bloque

5. **Formatear salida**: Convertir los números de día a etiquetas legibles (`1 → "Lu"`)

### Ejemplo de Proceso

**Registros en BD:**

```
tipo_dia | hora_inicio | hora_fin | precio_hora
---------|-------------|----------|------------
1        | 08:00       | 18:00    | 50000
1        | 18:00       | 22:00    | 80000
2        | 08:00       | 18:00    | 50000
2        | 18:00       | 22:00    | 80000
6        | 09:00       | 22:00    | 90000
```

**Agrupación:**

- Lunes (1) y Martes (2) tienen la misma firma → **Bloque 1**
- Sábado (6) tiene firma diferente → **Bloque 2**

**Salida:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma"],
      "horarios": [...]
    },
    {
      "dias": ["Sá"],
      "horarios": [...]
    }
  ]
}
```

---

## Algoritmo de Aplanamiento (PUT)

El algoritmo de aplanamiento funciona de la siguiente manera:

1. **Validar estructura** del JSON recibido

2. **Iniciar transacción** de Sequelize

3. **Eliminar registros existentes** de `cancha_horarios_precios` para esta cancha

4. **Recorrer cada bloque**:
   - Convertir etiquetas de días a números (`"Lu" → 1`)
   - Para cada día en el bloque:
     - Para cada franja horaria en el bloque:
       - Crear un registro plano

5. **Insertar masivamente** con `bulkCreate`

6. **Confirmar transacción**

### Ejemplo de Proceso

**JSON Recibido:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma"],
      "horarios": [
        { "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 50000 }
      ]
    }
  ]
}
```

**Registros Creados:**

```
cancha_id | tipo_dia | hora_inicio | hora_fin | precio_hora
----------|----------|-------------|----------|------------
1         | 1        | 08:00       | 18:00    | 50000
1         | 2        | 08:00       | 18:00    | 50000
```

---

## Notas Técnicas

### Transacciones

El endpoint PUT usa transacciones de Sequelize para garantizar la atomicidad:

- Si alguna operación falla, se revierten todos los cambios
- La BD nunca queda en un estado inconsistente

### Formato de Hora

- El backend acepta formato `HH:MM` (24 horas)
- Sequelize puede almacenar como `HH:MM:SS` internamente
- La función `normalizarHora()` garantiza que siempre se retorna `HH:MM`

### Orden de Días

Los días se ordenan según el orden natural de la semana:

```
Lu (1) → Ma (2) → Mi (3) → Ju (4) → Vi (5) → Sá (6) → Do (0) → Fes (7)
```

---

## Testing

### Con cURL

```bash
# GET - Obtener precios
curl -X GET http://localhost:3000/api/canchas/1/precios

# PUT - Guardar precios (requiere token)
curl -X PUT http://localhost:3000/api/canchas/1/precios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "bloques": [
      {
        "dias": ["Lu", "Ma", "Mi"],
        "horarios": [
          {
            "hora_inicio": "08:00",
            "hora_fin": "22:00",
            "precio_hora": 60000
          }
        ]
      }
    ]
  }'
```

### Con Postman/Insomnia

1. Crear una colección "Precios Bloques"
2. Importar los ejemplos de este documento
3. Configurar la variable de entorno `{{baseUrl}}` = `http://localhost:3000`
4. Configurar el header `Authorization` con tu token

---

## Changelog

### v1.0.0 (2026-06-13)

- ✅ Endpoint GET para obtener precios agrupados por bloques
- ✅ Endpoint PUT para guardar configuración de bloques
- ✅ Algoritmo de agrupación inteligente
- ✅ Validaciones exhaustivas del body
- ✅ Transacciones para garantizar consistencia
- ✅ Manejo robusto de errores

---

## Soporte

Para reportar bugs o sugerencias, contactar al equipo de desarrollo de Zyra.

**Documentado por:** Ingeniero Backend Senior  
**Fecha:** 13 de Junio, 2026
