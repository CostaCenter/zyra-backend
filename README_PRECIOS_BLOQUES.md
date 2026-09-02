# 🎯 Sistema de Precios por Bloques - Guía Rápida

## ✅ Implementación Completada

Se ha implementado exitosamente el endpoint independiente para la gestión de precios de canchas usando el sistema de bloques lógicos.

---

## 📁 Archivos Creados/Modificados

### Nuevos Archivos

```
backend-zyra/
├── src/
│   └── routes/
│       └── canchaPreciosRoutes.js          (NUEVO) ← Rutas independientes
├── docs/
│   └── API_PRECIOS_BLOQUES.md              (NUEVO) ← Documentación completa
├── tests/
│   └── precios-bloques.test.json           (NUEVO) ← Casos de prueba
└── README_PRECIOS_BLOQUES.md               (NUEVO) ← Esta guía
```

### Archivos Modificados

```
backend-zyra/
├── src/
│   ├── app.js                              (MODIFICADO) ← Registro de rutas
│   └── controllers/
│       └── courtPriceController.js         (MODIFICADO) ← Funciones nuevas
```

---

## 🚀 Endpoints Disponibles

### Base URL

```
/api/canchas/:id/precios
```

### GET - Obtener Precios Agrupados

```http
GET /api/canchas/1/precios
```

**Respuesta:**

```json
{
  "success": true,
  "data": {
    "cancha_id": 1,
    "bloques": [
      {
        "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
        "horarios": [
          { "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 50000 },
          { "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 80000 }
        ]
      }
    ]
  }
}
```

### PUT - Guardar Configuración

```http
PUT /api/canchas/1/precios
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
      "horarios": [
        { "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 50000 },
        { "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 80000 }
      ]
    },
    {
      "dias": ["Sá", "Do", "Fes"],
      "horarios": [
        { "hora_inicio": "09:00", "hora_fin": "22:00", "precio_hora": 90000 }
      ]
    }
  ]
}
```

---

## 🎨 Etiquetas de Días

| Etiqueta | Día | Valor en BD |
|----------|-----|-------------|
| `Lu` | Lunes | 1 |
| `Ma` | Martes | 2 |
| `Mi` | Miércoles | 3 |
| `Ju` | Jueves | 4 |
| `Vi` | Viernes | 5 |
| `Sá` | Sábado | 6 |
| `Do` | Domingo | 0 |
| `Fes` | Festivo | 7 |

---

## 🧪 Pruebas Rápidas

### Con cURL

```bash
# GET - Obtener precios
curl http://localhost:3000/api/canchas/1/precios

# PUT - Guardar precios (requiere token)
curl -X PUT http://localhost:3000/api/canchas/1/precios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "bloques": [
      {
        "dias": ["Lu", "Ma", "Mi"],
        "horarios": [
          { "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000 }
        ]
      }
    ]
  }'
```

### Con Node.js (Ejemplo)

```javascript
// GET
const response = await fetch('http://localhost:3000/api/canchas/1/precios');
const data = await response.json();
console.log(data.data.bloques);

// PUT
const response = await fetch('http://localhost:3000/api/canchas/1/precios', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    bloques: [
      {
        dias: ['Lu', 'Ma', 'Mi'],
        horarios: [
          { hora_inicio: '08:00', hora_fin: '22:00', precio_hora: 60000 }
        ]
      }
    ]
  })
});
```

---

## 🔧 Funciones Implementadas

### 1. `getPreciosBloques()` - GET

**Ubicación:** `src/controllers/courtPriceController.js`

**Función:**
- Obtiene todos los registros planos de la BD
- Los agrupa en bloques lógicos (días con mismas franjas)
- Retorna estructura optimizada para el frontend

**Algoritmo de Agrupación:**

```
1. Obtener registros de la BD
2. Agrupar por día (tipo_dia)
3. Generar "firma" única para cada conjunto de franjas
4. Agrupar días con la misma firma
5. Convertir números a etiquetas (1 → "Lu")
```

---

### 2. `setPreciosBloques()` - PUT

**Ubicación:** `src/controllers/courtPriceController.js`

**Función:**
- Recibe array de bloques del frontend
- Elimina configuración anterior
- Aplana bloques y crea registros individuales
- Todo en una transacción

**Algoritmo de Aplanamiento:**

```
1. Validar estructura del JSON
2. Iniciar transacción
3. Eliminar registros existentes
4. Para cada bloque:
   - Convertir etiquetas a números ("Lu" → 1)
   - Para cada día:
     - Para cada franja:
       - Crear registro plano
5. BulkCreate masivo
6. Commit transacción
```

---

## 📊 Ejemplos de Uso

### Caso 1: Configuración Simple

**Todos los días con el mismo precio:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"],
      "horarios": [
        { "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000 }
      ]
    }
  ]
}
```

**Resultado:** 7 registros en la BD

---

### Caso 2: Semana vs Fin de Semana

**Precios diferenciados por franjas horarias:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
      "horarios": [
        { "hora_inicio": "08:00", "hora_fin": "18:00", "precio_hora": 50000 },
        { "hora_inicio": "18:00", "hora_fin": "22:00", "precio_hora": 70000 }
      ]
    },
    {
      "dias": ["Sá", "Do"],
      "horarios": [
        { "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 90000 }
      ]
    }
  ]
}
```

**Resultado:** 12 registros en la BD (5 días × 2 franjas + 2 días × 1 franja)

---

### Caso 3: Incluir Festivos

**Festivos con precio especial:**

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi", "Ju", "Vi"],
      "horarios": [
        { "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000 }
      ]
    },
    {
      "dias": ["Sá", "Do", "Fes"],
      "horarios": [
        { "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 100000 }
      ]
    }
  ]
}
```

**Resultado:** 8 registros en la BD

---

## 🛡️ Validaciones

El endpoint valida:

- ✅ Estructura del JSON (bloques debe ser array)
- ✅ Cada bloque tiene `dias` y `horarios`
- ✅ Etiquetas de días son válidas (Lu, Ma, Mi, etc.)
- ✅ Formato de hora es HH:MM (24 horas)
- ✅ Precio es número >= 0
- ✅ Usuario tiene permisos sobre la cancha

---

## ⚠️ Errores Comunes

### 1. Etiqueta de día incorrecta

```json
// ❌ INCORRECTO
{ "dias": ["Lun", "Mar"] }

// ✅ CORRECTO
{ "dias": ["Lu", "Ma"] }
```

---

### 2. Formato de hora incorrecto

```json
// ❌ INCORRECTO
{ "hora_inicio": "8:00" }

// ✅ CORRECTO
{ "hora_inicio": "08:00" }
```

---

### 3. Precio inválido

```json
// ❌ INCORRECTO
{ "precio_hora": "50000" }  // String

// ✅ CORRECTO
{ "precio_hora": 50000 }    // Número
```

---

## 🔐 Seguridad

### GET
- Acceso público (no requiere autenticación)

### PUT
- Requiere token JWT válido
- Valida que el usuario sea dueño del complejo
- Usa transacciones para prevenir inconsistencias

---

## 📚 Documentación Adicional

Para más detalles, consultar:

- **Documentación completa:** `docs/API_PRECIOS_BLOQUES.md`
- **Casos de prueba:** `tests/precios-bloques.test.json`

---

## 🎯 Integración con el Frontend

### Paso 1: Obtener precios al cargar la página

```javascript
const obtenerPrecios = async (canchaId) => {
  const response = await fetch(`/api/canchas/${canchaId}/precios`);
  const { data } = await response.json();
  setBloques(data.bloques);
};
```

### Paso 2: Guardar cambios

```javascript
const guardarPrecios = async (canchaId, bloques) => {
  const response = await fetch(`/api/canchas/${canchaId}/precios`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ bloques })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Precios guardados exitosamente');
  }
};
```

---

## 🚦 Estados del Sistema

### Estado Inicial (Sin precios configurados)

```json
{
  "bloques": []
}
```

### Estado con Configuración

```json
{
  "bloques": [
    {
      "dias": ["Lu", "Ma", "Mi"],
      "horarios": [...]
    }
  ]
}
```

---

## 💡 Consejos de Uso

1. **Siempre valida el formato** antes de enviar al backend
2. **Usa las etiquetas correctas** de días (Lu, Ma, Mi, etc.)
3. **Formato de hora consistente** (HH:MM)
4. **Precios como números**, no strings
5. **Agrupa días con las mismas franjas** para simplificar la configuración

---

## ✨ Características Principales

- ✅ **Agrupación inteligente** por bloques lógicos
- ✅ **Transacciones** para garantizar consistencia
- ✅ **Validaciones exhaustivas** del input
- ✅ **Manejo robusto de errores**
- ✅ **Código limpio y documentado**
- ✅ **Optimizado para el frontend**

---

## 📞 Soporte

Para dudas o problemas, contactar al equipo de desarrollo de Zyra.

**Desarrollado por:** Ingeniero Backend Senior experto en Node.js y Sequelize  
**Fecha de implementación:** 13 de Junio, 2026  
**Versión:** 1.0.0
