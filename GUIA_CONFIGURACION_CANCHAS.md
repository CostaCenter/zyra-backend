# 🎯 Guía Completa de Configuración de Canchas - Zyra

## 📋 Índice

1. [Resumen Ejecutivo](#-resumen-ejecutivo)
2. [Arquitectura del Sistema](#-arquitectura-del-sistema)
3. [Flujo de Configuración](#-flujo-de-configuración)
4. [Gestión de Canchas](#-gestión-de-canchas)
5. [Gestión de Precios Dinámicos](#-gestión-de-precios-dinámicos)
6. [Gestión de Excepciones](#-gestión-de-excepciones)
7. [Casos de Uso Reales](#-casos-de-uso-reales)
8. [Sistema de Prioridades](#-sistema-de-prioridades)
9. [Mejores Prácticas](#-mejores-prácticas)

---

## 🎓 Resumen Ejecutivo

Este sistema permite configurar canchas deportivas con **precios dinámicos** que varían según:
- Día de la semana
- Franja horaria
- Fechas especiales (festivos, cierres)

### Características Principales

✅ **CRUD Completo de Canchas**
- Crear, listar, actualizar y eliminar canchas
- Asociación automática con complejos deportivos
- Validación de permisos (solo dueños)

✅ **Precios Dinámicos por Cancha**
- Precios diferenciados por día de la semana (0-6)
- Precios especiales para festivos (tipo_dia: 7)
- Múltiples franjas horarias por día
- Configuración granular o masiva

✅ **Excepciones de Calendario por Complejo**
- Festivos con precios especiales
- Cierres programados
- Eventos especiales
- Importación masiva de fechas

---

## 🏗️ Arquitectura del Sistema

### Jerarquía de Entidades

```
Usuario (Dueño)
    └── Complejo Deportivo
            ├── Horarios Base (complejo_horarios)
            ├── Excepciones (calendario_excepciones)
            └── Canchas
                    ├── Precio Base (canchas.precio_hora)
                    └── Precios Dinámicos (cancha_horarios_precios)
```

### Modelos de Base de Datos

#### Tabla: `canchas`
```sql
id              INTEGER PRIMARY KEY
complejo_id     INTEGER         -- FK a complejos
nombre          VARCHAR         -- "Cancha 1", "Sintética Pro"
tipo_deporte    VARCHAR         -- "Fútbol", "Voley"
sport_id        INTEGER         -- FK a sports
precio_hora     DECIMAL(10,2)   -- Precio base
state           VARCHAR         -- DISPONIBLE, MANTENIMIENTO, etc.
photo           TEXT            -- URL de la foto
```

#### Tabla: `cancha_horarios_precios`
```sql
id              INTEGER PRIMARY KEY
cancha_id       INTEGER         -- FK a canchas
tipo_dia        INTEGER         -- 0=Dom, 1=Lun, ..., 6=Sab, 7=FESTIVO
hora_inicio     TIME            -- "08:00"
hora_fin        TIME            -- "14:00"
precio_hora     DECIMAL(10,2)   -- 60000
```

#### Tabla: `calendario_excepciones`
```sql
id              INTEGER PRIMARY KEY
complejo_id     INTEGER         -- FK a complejos
fecha           DATE UNIQUE     -- "2026-07-20"
esta_abierto    BOOLEAN         -- true/false
es_festivo      BOOLEAN         -- true si es festivo
descripcion     VARCHAR         -- "Día de la Independencia"
```

---

## 🚀 Flujo de Configuración

### Orden Recomendado

1. **Configurar Horarios del Complejo** (opcional pero recomendado)
   - Define horarios base de apertura/cierre

2. **Configurar Excepciones del Complejo** (festivos, cierres)
   - Importar festivos nacionales
   - Agregar cierres por mantenimiento

3. **Crear Canchas**
   - Con precio base inicial

4. **Configurar Precios Dinámicos por Cancha**
   - Según estrategia de negocio

---

## 🏟️ Gestión de Canchas

### 1. Crear Cancha

**Endpoint:** `POST /api/courts`  
**Autenticación:** Requerida (solo dueños del complejo)

**Request:**
```json
{
  "complejo_id": 3,
  "nombre": "Cancha Fútbol 5 - Principal",
  "tipo_deporte": "Fútbol",
  "sport_id": 1,
  "precio_hora": 50000,
  "state": "DISPONIBLE",
  "photo": "https://mi-servidor.com/foto-cancha1.jpg"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Cancha creada exitosamente",
  "data": {
    "id": 8,
    "complejo_id": 3,
    "nombre": "Cancha Fútbol 5 - Principal",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": "50000.00",
    "state": "DISPONIBLE",
    "photo": "https://mi-servidor.com/foto-cancha1.jpg",
    "complejo": {
      "id": 3,
      "nombre": "Complejo El Campeón",
      "ubicacion": "Cali"
    },
    "sport": {
      "id": 1,
      "name": "Fútbol"
    }
  }
}
```

**Comando cURL:**
```bash
curl -X POST http://localhost:3000/api/courts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "complejo_id": 3,
    "nombre": "Cancha Fútbol 5 - Principal",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": 50000,
    "state": "DISPONIBLE"
  }'
```

**Campos Obligatorios:**
- `complejo_id` (número): ID del complejo al que pertenece
- `nombre` (string): Nombre descriptivo de la cancha

**Campos Opcionales:**
- `tipo_deporte` (string): Tipo de deporte
- `sport_id` (número): ID del deporte (FK a tabla sports)
- `precio_hora` (decimal): Precio base por hora
- `state` (string): DISPONIBLE | OCUPADA | MANTENIMIENTO | FUERA DE SERVICIO
- `photo` (string): URL de la foto

**Validaciones:**
- El complejo debe existir
- El usuario debe ser dueño del complejo
- Si se proporciona `sport_id`, el deporte debe existir

---

### 2. Listar Canchas de un Complejo

**Endpoint:** `GET /api/courts/complex/:complexId`  
**Autenticación:** No requerida (público)

**Ejemplo:** `GET /api/courts/complex/3`

**Response (200):**
```json
{
  "success": true,
  "message": "Canchas del complejo",
  "count": 2,
  "data": [
    {
      "id": 8,
      "complejo_id": 3,
      "nombre": "Cancha Fútbol 5 - Principal",
      "precio_hora": "50000.00",
      "state": "DISPONIBLE",
      "complejo": {
        "id": 3,
        "nombre": "Complejo El Campeón",
        "ubicacion": "Cali"
      },
      "sport": {
        "id": 1,
        "name": "Fútbol"
      }
    },
    {
      "id": 9,
      "complejo_id": 3,
      "nombre": "Cancha Fútbol 5 - Secundaria",
      "precio_hora": "45000.00",
      "state": "DISPONIBLE",
      "complejo": {...},
      "sport": {...}
    }
  ]
}
```

---

### 3. Obtener Cancha por ID

**Endpoint:** `GET /api/courts/:id`  
**Autenticación:** No requerida

**Ejemplo:** `GET /api/courts/8`

---

### 4. Actualizar Cancha

**Endpoint:** `PUT /api/courts/:id`  
**Autenticación:** Requerida (solo dueño)

**Request (todos los campos opcionales):**
```json
{
  "nombre": "Cancha Fútbol 5 - VIP",
  "precio_hora": 60000,
  "state": "MANTENIMIENTO"
}
```

**Comando cURL:**
```bash
curl -X PUT http://localhost:3000/api/courts/8 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Cancha Fútbol 5 - VIP",
    "precio_hora": 60000
  }'
```

---

### 5. Eliminar Cancha

**Endpoint:** `DELETE /api/courts/:id`  
**Autenticación:** Requerida (solo dueño)

**Comando cURL:**
```bash
curl -X DELETE http://localhost:3000/api/courts/8 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 💰 Gestión de Precios Dinámicos

Los precios dinámicos permiten establecer tarifas diferentes según:
- Día de la semana
- Franja horaria
- Si es festivo

### Conceptos Clave

#### `tipo_dia` (0-7)
```
0 = Domingo
1 = Lunes
2 = Martes
3 = Miércoles
4 = Jueves
5 = Viernes
6 = Sábado
7 = FESTIVO (días marcados en calendario_excepciones con es_festivo=true)
```

#### Franjas Horarias
Cada día puede tener múltiples franjas con precios diferentes:
```
Viernes (tipo_dia: 5):
  08:00 - 18:00  →  $60,000/hora
  18:00 - 23:00  →  $100,000/hora (horario prime)
```

---

### 1. Configurar Precios Dinámicos

**Endpoint:** `POST /api/courts/:id/precios`  
**Autenticación:** Requerida (solo dueño)

**Request:**
```json
{
  "precios": [
    {
      "tipo_dia": 1,
      "hora_inicio": "08:00",
      "hora_fin": "22:00",
      "precio_hora": 60000
    },
    {
      "tipo_dia": 5,
      "hora_inicio": "08:00",
      "hora_fin": "18:00",
      "precio_hora": 60000
    },
    {
      "tipo_dia": 5,
      "hora_inicio": "18:00",
      "hora_fin": "23:00",
      "precio_hora": 100000
    },
    {
      "tipo_dia": 6,
      "hora_inicio": "09:00",
      "hora_fin": "23:00",
      "precio_hora": 90000
    },
    {
      "tipo_dia": 7,
      "hora_inicio": "08:00",
      "hora_fin": "23:00",
      "precio_hora": 120000
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Precios configurados exitosamente",
  "data": {
    "cancha_id": 8,
    "cancha_nombre": "Cancha Fútbol 5 - Principal",
    "precios": [
      {
        "tipo_dia": 1,
        "dia_nombre": "Lunes",
        "franjas": [
          {
            "hora_inicio": "08:00",
            "hora_fin": "22:00",
            "precio_hora": 60000
          }
        ]
      },
      {
        "tipo_dia": 5,
        "dia_nombre": "Viernes",
        "franjas": [
          {
            "hora_inicio": "08:00",
            "hora_fin": "18:00",
            "precio_hora": 60000
          },
          {
            "hora_inicio": "18:00",
            "hora_fin": "23:00",
            "precio_hora": 100000
          }
        ]
      },
      {
        "tipo_dia": 6,
        "dia_nombre": "Sábado",
        "franjas": [
          {
            "hora_inicio": "09:00",
            "hora_fin": "23:00",
            "precio_hora": 90000
          }
        ]
      },
      {
        "tipo_dia": 7,
        "dia_nombre": "Festivo",
        "franjas": [
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

**Comando cURL:**
```bash
curl -X POST http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "precios": [
      {"tipo_dia": 1, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000},
      {"tipo_dia": 5, "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 60000},
      {"tipo_dia": 5, "hora_inicio": "18:00", "hora_fin": "23:00", "precio_hora": 100000},
      {"tipo_dia": 6, "hora_inicio": "09:00", "hora_fin": "23:00", "precio_hora": 90000},
      {"tipo_dia": 7, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 120000}
    ]
  }'
```

**Nota Importante:** Este endpoint **reemplaza** todos los precios anteriores de la cancha.

---

### 2. Consultar Precios Configurados

**Endpoint:** `GET /api/courts/:id/precios`  
**Autenticación:** No requerida (público)

**Ejemplo:** `GET /api/courts/8/precios`

**Response con precios dinámicos:**
```json
{
  "success": true,
  "message": "Configuración de precios obtenida exitosamente",
  "data": {
    "cancha_id": 8,
    "cancha_nombre": "Cancha Fútbol 5 - Principal",
    "precio_base": 50000,
    "tiene_precios_dinamicos": true,
    "precios": [...]
  }
}
```

**Response sin precios dinámicos:**
```json
{
  "success": true,
  "message": "La cancha usa precio base (sin configuración dinámica)",
  "data": {
    "cancha_id": 8,
    "cancha_nombre": "Cancha Fútbol 5 - Principal",
    "precio_base": 50000,
    "tiene_precios_dinamicos": false,
    "precios": []
  }
}
```

---

### 3. Actualizar una Franja Específica

**Endpoint:** `PUT /api/courts/:id/precios/:precioId`  
**Autenticación:** Requerida (solo dueño)

**Request (todos los campos opcionales):**
```json
{
  "precio_hora": 95000
}
```

**Comando cURL:**
```bash
# Primero obtén el ID de la franja con GET /api/courts/8/precios
# Luego actualiza:

curl -X PUT http://localhost:3000/api/courts/8/precios/46 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"precio_hora": 95000}'
```

---

### 4. Eliminar una Franja Específica

**Endpoint:** `DELETE /api/courts/:id/precios/:precioId`  
**Autenticación:** Requerida (solo dueño)

**Comando cURL:**
```bash
curl -X DELETE http://localhost:3000/api/courts/8/precios/46 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. Eliminar Todos los Precios Dinámicos

**Endpoint:** `DELETE /api/courts/:id/precios`  
**Autenticación:** Requerida (solo dueño)

La cancha volverá a usar el `precio_base` configurado en `canchas.precio_hora`.

**Comando cURL:**
```bash
curl -X DELETE http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📅 Gestión de Excepciones

Las excepciones se configuran **a nivel de complejo** y afectan a todas sus canchas.

### Tipos de Excepciones

1. **Festivos con precios especiales**
   - `esta_abierto: true`
   - `es_festivo: true`
   - El sistema buscará precios con `tipo_dia: 7`

2. **Cierres totales**
   - `esta_abierto: false`
   - El complejo está cerrado (mantenimiento, evento privado)

3. **Eventos especiales sin cambio de precio**
   - `esta_abierto: true`
   - `es_festivo: false`
   - Solo informativo

---

### 1. Agregar una Excepción

**Endpoint:** `POST /api/complexes/:id/excepciones`  
**Autenticación:** Requerida (solo dueño)

**Ejemplo: Festivo**
```json
{
  "fecha": "2026-07-20",
  "esta_abierto": true,
  "es_festivo": true,
  "descripcion": "Día de la Independencia de Colombia"
}
```

**Ejemplo: Cierre por Mantenimiento**
```json
{
  "fecha": "2026-08-15",
  "esta_abierto": false,
  "es_festivo": false,
  "descripcion": "Mantenimiento general de canchas"
}
```

**Comando cURL (festivo):**
```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-07-20",
    "esta_abierto": true,
    "es_festivo": true,
    "descripcion": "Día de la Independencia de Colombia"
  }'
```

---

### 2. Agregar Excepciones Masivas (Bulk)

**Endpoint:** `POST /api/complexes/:id/excepciones/bulk`  
**Autenticación:** Requerida (solo dueño)

**Request:**
```json
{
  "excepciones": [
    {
      "fecha": "2026-01-01",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Año Nuevo"
    },
    {
      "fecha": "2026-01-12",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Día de los Reyes Magos"
    },
    {
      "fecha": "2026-03-23",
      "esta_abierto": true,
      "es_festivo": true,
      "descripcion": "Día de San José"
    }
  ]
}
```

**Usando archivo JSON predefinido:**
```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/festivos-colombia-2026.json
```

**Archivo:** `src/routes/data/festivos-colombia-2026.json` (19 festivos incluidos)

---

### 3. Listar Excepciones

**Endpoint:** `GET /api/complexes/:id/excepciones`  
**Autenticación:** No requerida (público)

**Filtros disponibles:**
- `?desde=2026-06-01&hasta=2026-08-31` - Rango de fechas
- `?solo_festivos=true` - Solo festivos
- `?solo_cerrados=true` - Solo días cerrados

**Ejemplos:**
```bash
# Todas las excepciones
curl http://localhost:3000/api/complexes/3/excepciones

# Excepciones entre fechas
curl "http://localhost:3000/api/complexes/3/excepciones?desde=2026-06-01&hasta=2026-08-31"

# Solo festivos
curl "http://localhost:3000/api/complexes/3/excepciones?solo_festivos=true"

# Solo días cerrados
curl "http://localhost:3000/api/complexes/3/excepciones?solo_cerrados=true"
```

---

### 4. Consultar Fecha Específica

**Endpoint:** `GET /api/complexes/:id/excepciones/:fecha`  
**Autenticación:** No requerida

**Ejemplo:** `GET /api/complexes/3/excepciones/2026-07-20`

**Response (si existe):**
```json
{
  "success": true,
  "message": "Excepción encontrada para la fecha 2026-07-20",
  "data": {
    "id": 5,
    "complejo_id": 3,
    "fecha": "2026-07-20",
    "esta_abierto": true,
    "es_festivo": true,
    "descripcion": "Día de la Independencia de Colombia 🇨🇴"
  }
}
```

**Response (si no existe):**
```json
{
  "success": true,
  "message": "No hay excepción configurada para la fecha 2026-07-20",
  "data": null
}
```

---

### 5. Actualizar Excepción

**Endpoint:** `PUT /api/complexes/:id/excepciones/:fecha`  
**Autenticación:** Requerida (solo dueño)

**Request (todos los campos opcionales):**
```json
{
  "descripcion": "Independencia de Colombia 🇨🇴",
  "esta_abierto": true
}
```

**Comando cURL:**
```bash
curl -X PUT http://localhost:3000/api/complexes/3/excepciones/2026-07-20 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "descripcion": "Independencia de Colombia 🇨🇴"
  }'
```

---

### 6. Eliminar Excepción

**Endpoint:** `DELETE /api/complexes/:id/excepciones/:fecha`  
**Autenticación:** Requerida (solo dueño)

**Comando cURL:**
```bash
curl -X DELETE http://localhost:3000/api/complexes/3/excepciones/2026-07-20 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 💼 Casos de Uso Reales

### Caso 1: Complejo Nuevo con Estrategia Premium

**Objetivo:** Configurar un complejo que cobra más en horarios prime y festivos.

**Pasos:**

1. **Crear cancha**
```bash
curl -X POST http://localhost:3000/api/courts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "complejo_id": 10,
    "nombre": "Cancha Principal - Sintética",
    "tipo_deporte": "Fútbol",
    "sport_id": 1,
    "precio_hora": 50000,
    "state": "DISPONIBLE"
  }'
```

2. **Importar festivos de Colombia 2026**
```bash
curl -X POST http://localhost:3000/api/complexes/10/excepciones/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/festivos-colombia-2026.json
```

3. **Configurar precios dinámicos (estrategia prime)**
```bash
curl -X POST http://localhost:3000/api/courts/15/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-prime.json
```

**Resultado:**
- Lunes a jueves: $60,000/hora todo el día
- Viernes: $60,000 hasta las 18h, luego $100,000
- Sábado: $90,000 todo el día
- Festivos: $120,000 todo el día

---

### Caso 2: Estrategia Happy Hour

**Objetivo:** Incentivar reservas en horarios de baja demanda.

**Archivo:** `src/routes/data/precios-estrategia-happy-hour.json`

**Comando:**
```bash
curl -X POST http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-happy-hour.json
```

**Estrategia:**
- Lun-Vie 08:00-12:00: $40,000 (descuento mañana)
- Lun-Vie 12:00-18:00: $60,000 (precio normal)
- Lun-Vie 18:00-22:00: $80,000 (horario prime)
- Fin de semana: precios más altos
- Festivos: precios premium

---

### Caso 3: Cierre por Mantenimiento Programado

**Objetivo:** Cerrar el complejo una semana para mantenimiento.

**Comando:**
```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "excepciones": [
      {"fecha": "2026-08-10", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 1"},
      {"fecha": "2026-08-11", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 2"},
      {"fecha": "2026-08-12", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 3"},
      {"fecha": "2026-08-13", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 4"},
      {"fecha": "2026-08-14", "esta_abierto": false, "es_festivo": false, "descripcion": "Mantenimiento Día 5"}
    ]
  }'
```

---

### Caso 4: Cambiar Estrategia de Precios

**Objetivo:** Pasar de estrategia premium a precio único simplificado.

**Pasos:**

1. **Eliminar precios dinámicos actuales**
```bash
curl -X DELETE http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN"
```

2. **Aplicar nueva estrategia simple**
```bash
curl -X POST http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-simple.json
```

---

## 🎯 Sistema de Prioridades

### Cálculo de Precio Final (Orden de Prioridad)

Cuando un usuario intenta reservar una cancha en una fecha/hora específica, el sistema calcula el precio en este orden:

1. **¿El complejo está cerrado?** (calendario_excepciones.esta_abierto = false)
   - ❌ No se puede reservar

2. **¿Es un festivo?** (calendario_excepciones.es_festivo = true)
   - ✅ Buscar precio con `tipo_dia: 7` en la franja horaria
   - Si existe → usar ese precio
   - Si no existe → usar precio base

3. **¿Tiene precios dinámicos para ese día?**
   - ✅ Buscar precio con `tipo_dia: [0-6]` en la franja horaria
   - Si existe → usar ese precio
   - Si no existe en esa franja → usar precio base

4. **Precio base**
   - Si nada coincide → usar `canchas.precio_hora`

### Ejemplo Práctico

**Fecha:** Viernes 20 de Julio, 2026 a las 19:00  
**Cancha:** ID 8

**Paso 1:** Consultar `calendario_excepciones`
```sql
SELECT * FROM calendario_excepciones 
WHERE complejo_id = 3 AND fecha = '2026-07-20'
```
**Resultado:** Es festivo (Independencia de Colombia), `es_festivo = true`

**Paso 2:** Buscar precio para festivos (tipo_dia: 7)
```sql
SELECT * FROM cancha_horarios_precios
WHERE cancha_id = 8 
  AND tipo_dia = 7 
  AND hora_inicio <= '19:00' 
  AND hora_fin > '19:00'
```
**Resultado:** Precio festivo → **$120,000/hora**

---

## ✅ Mejores Prácticas

### 1. Configuración Inicial

- ✅ Define primero los horarios base del complejo
- ✅ Importa todos los festivos nacionales al inicio del año
- ✅ Crea las canchas con un precio base razonable
- ✅ Luego configura precios dinámicos si es necesario

### 2. Precios Dinámicos

- ✅ No todas las canchas necesitan precios dinámicos
- ✅ Usa el precio base para canchas simples
- ✅ Evita sobrecomplicar con muchas franjas horarias
- ✅ Mantén coherencia entre canchas similares

### 3. Excepciones

- ✅ Importa festivos masivamente (usa el archivo JSON)
- ✅ Marca claramente los festivos con `es_festivo: true`
- ✅ Usa descripciones claras y en español
- ✅ Programa cierres con anticipación

### 4. Mantenimiento

- ✅ Revisa precios trimestralmente
- ✅ Actualiza festivos al inicio de cada año
- ✅ Documenta cambios de estrategia
- ✅ Analiza demanda antes de ajustar precios

### 5. Seguridad

- ✅ Solo dueños pueden modificar precios
- ✅ Las consultas públicas no requieren autenticación
- ✅ Valida todos los permisos en el backend
- ✅ Nunca confíes en validaciones solo del frontend

---

## 📊 Estrategias Predefinidas

El sistema incluye 3 estrategias listas para usar:

### 1. Estrategia Prime
**Archivo:** `src/routes/data/precios-estrategia-prime.json`

- Lun-Jue: $60,000 todo el día
- Vie: $60,000 hasta 18h, $100,000 después
- Sáb: $90,000 todo el día
- Festivos: $120,000 todo el día

**Uso:**
```bash
curl -X POST http://localhost:3000/api/courts/8/precios \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @src/routes/data/precios-estrategia-prime.json
```

### 2. Estrategia Happy Hour
**Archivo:** `src/routes/data/precios-estrategia-happy-hour.json`

- Descuentos en horarios de baja demanda
- 21 configuraciones de precios
- Incentiva reservas en horas valle

### 3. Estrategia Simple
**Archivo:** `src/routes/data/precios-estrategia-simple.json`

- Precio único por día
- Más caro fin de semana
- Simple de entender para usuarios

---

## 🆘 Solución de Problemas

### Error 404: Cancha/Complejo no encontrado

**Causa:** El ID no existe en la base de datos.

**Solución:**
```bash
# Verificar que el complejo existe
curl http://localhost:3000/api/complexes/3

# Verificar que la cancha existe
curl http://localhost:3000/api/courts/8

# Listar canchas del complejo
curl http://localhost:3000/api/courts/complex/3
```

### Error 403: Sin permisos

**Causa:** No eres el dueño del complejo.

**Solución:**
```bash
# Verifica tus complejos
curl http://localhost:3000/api/complexes/my-complexes \
  -H "Authorization: Bearer $TOKEN"
```

### Error 400: Validación de datos

**Causa:** Formato de hora incorrecto o tipo_dia fuera de rango.

**Solución:**
- Horas en formato `HH:MM` (24 horas): "08:00", "14:30", "23:00"
- tipo_dia entre 0-7
- precio_hora >= 0

### Token expirado

**Solución:**
```bash
# Obtener nuevo token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "tu@email.com", "password": "tupassword"}'
```

---

## 📚 Archivos de Referencia

| Archivo | Descripción |
|---------|-------------|
| `RESUMEN_IMPLEMENTACION.md` | Estado de implementación, métricas |
| `COMANDOS_PRUEBA.md` | 30+ comandos listos para copiar |
| `COURTS_README.md` | Documentación de CRUD de canchas |
| `src/routes/PRECIOS_CANCHA_EXAMPLES.md` | 15 páginas sobre precios dinámicos |
| `src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md` | 20 páginas sobre excepciones |
| `src/routes/data/festivos-colombia-2026.json` | 19 festivos oficiales |
| `src/routes/data/precios-estrategia-*.json` | 3 estrategias predefinidas |

---

## 🚀 Siguiente Nivel

### Funcionalidades Avanzadas (Opcional)

1. **Motor de Cálculo de Precios**
   - Servicio que calcula automáticamente el precio final
   - Considera excepciones, precios dinámicos y precio base

2. **Dashboard de Gestión**
   - UI visual para configurar precios
   - Calendario con festivos y cierres
   - Gráficos de ocupación y precios

3. **Historial de Cambios**
   - Auditoría de modificaciones de precios
   - Quién cambió qué y cuándo

4. **Plantillas de Precios**
   - Guardar configuraciones como plantillas
   - Aplicar a múltiples canchas rápidamente

5. **Notificaciones**
   - Avisar a usuarios sobre cambios de precio
   - Alertas de cierres programados

---

## ✨ Conclusión

Este sistema proporciona una **gestión profesional y flexible** de canchas deportivas con precios dinámicos.

**Características principales:**
- ✅ CRUD completo de canchas
- ✅ Precios dinámicos por día y hora
- ✅ Precios especiales para festivos
- ✅ Gestión de cierres y excepciones
- ✅ Seguridad robusta (solo dueños)
- ✅ APIs públicas para consultas
- ✅ 3 estrategias predefinidas
- ✅ 19 festivos de Colombia 2026
- ✅ Documentación completa

**Listo para producción** 🚀

---

**Última actualización:** 17 de Abril, 2026  
**Versión:** 1.0  
**Autor:** Sistema Zyra Backend
