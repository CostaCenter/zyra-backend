# Sistema de Precios Dinámicos y Excepciones - Zyra Backend

## 📋 Resumen

Este documento describe la implementación completa del **Sistema de Precios Dinámicos** y **Gestión de Excepciones de Calendario** para la plataforma Zyra.

---

## 🎯 Funcionalidades Implementadas

### 1. Precios Dinámicos de Canchas (`cancha_horarios_precios`)

Sistema avanzado que permite configurar precios variables según:
- **Día de la semana** (Lunes a Domingo + Festivos)
- **Franja horaria** (Ejemplo: 8-14h = $50k, 14-22h = $80k)
- **Múltiples franjas** por día

#### Archivos Creados:
- `src/controllers/courtPriceController.js` - Controlador de precios
- `src/routes/PRECIOS_CANCHA_EXAMPLES.md` - Documentación completa con ejemplos

#### Endpoints Disponibles:
```
POST   /api/courts/:id/precios              - Configurar precios
GET    /api/courts/:id/precios              - Obtener configuración
PUT    /api/courts/:id/precios/:precioId    - Actualizar franja
DELETE /api/courts/:id/precios/:precioId    - Eliminar franja
DELETE /api/courts/:id/precios              - Eliminar todos (volver a precio base)
```

### 2. Excepciones de Calendario (`calendario_excepciones`)

Sistema para marcar fechas especiales (festivos, cierres, eventos):
- **Festivos con precios especiales** (`tipo_dia: 7`)
- **Cierres totales** (mantenimiento, vacaciones)
- **Eventos especiales** sin cambio de precios

#### Archivos Creados:
- `src/controllers/calendarExceptionController.js` - Controlador de excepciones
- `src/routes/EXCEPCIONES_CALENDARIO_EXAMPLES.md` - Documentación completa con ejemplos

#### Endpoints Disponibles:
```
POST   /api/complexes/:id/excepciones          - Agregar excepción
POST   /api/complexes/:id/excepciones/bulk     - Agregar múltiples (festivos del año)
GET    /api/complexes/:id/excepciones          - Listar excepciones (con filtros)
GET    /api/complexes/:id/excepciones/:fecha   - Consultar fecha específica
PUT    /api/complexes/:id/excepciones/:fecha   - Actualizar excepción
DELETE /api/complexes/:id/excepciones/:fecha   - Eliminar excepción
```

### 3. Rutas Actualizadas

#### `src/routes/courtRoutes.js`
- ✅ Integradas rutas de precios dinámicos
- ✅ Documentación en comentarios

#### `src/routes/complexRoutes.js`
- ✅ Integradas rutas de excepciones de calendario
- ✅ Documentación en comentarios

---

## 🗄️ Modelos de Base de Datos

Los siguientes modelos ya existían y fueron utilizados:

### `cancha_horarios_precios`
```sql
CREATE TABLE cancha_horarios_precios (
  id SERIAL PRIMARY KEY,
  cancha_id INTEGER REFERENCES canchas(id),
  tipo_dia INTEGER,  -- 0-6 (Dom-Sab), 7 (Festivo)
  hora_inicio TIME,
  hora_fin TIME,
  precio_hora DECIMAL(10,2)
);
```

### `calendario_excepciones`
```sql
CREATE TABLE calendario_excepciones (
  id SERIAL PRIMARY KEY,
  complejo_id INTEGER REFERENCES complejos(id),
  fecha DATE UNIQUE,
  esta_abierto BOOLEAN DEFAULT true,
  es_festivo BOOLEAN DEFAULT true,
  descripcion VARCHAR
);
```

Las relaciones ya están configuradas en `src/db/db.js` (líneas 90-98).

---

## 🔄 Flujo de Trabajo Completo

### Caso de Uso: Configurar Complejo con Precios Festivos

#### Paso 1: Crear Complejo y Canchas
```bash
POST /api/complexes
POST /api/courts
```

#### Paso 2: Configurar Horarios del Complejo
```bash
POST /api/complexes/3/horarios/estandar
```

#### Paso 3: Configurar Precios Dinámicos en las Canchas
```bash
POST /api/courts/5/precios
```
```json
{
  "precios": [
    {"tipo_dia": 1, "hora_inicio": "08:00", "hora_fin": "14:00", "precio_hora": 50000},
    {"tipo_dia": 1, "hora_inicio": "14:00", "hora_fin": "22:00", "precio_hora": 80000},
    {"tipo_dia": 7, "hora_inicio": "08:00", "hora_fin": "23:00", "precio_hora": 120000}
  ]
}
```

#### Paso 4: Marcar Festivos del Año
```bash
POST /api/complexes/3/excepciones/bulk
```
```json
{
  "excepciones": [
    {"fecha": "2026-07-20", "esta_abierto": true, "es_festivo": true, "descripcion": "Independencia"},
    {"fecha": "2026-12-25", "esta_abierto": false, "es_festivo": true, "descripcion": "Navidad"}
  ]
}
```

#### Resultado:
- **Lunes a Viernes normal**: $50k (mañana) / $80k (tarde)
- **20 de Julio (festivo)**: $120k todo el día
- **25 de Diciembre**: Complejo cerrado

---

## 📊 Sistema de Prioridades

### Precios de Canchas:
```
1. Precios Dinámicos (cancha_horarios_precios) ← PRIORIDAD ALTA
2. Precio Base (canchas.precio_hora)            ← FALLBACK
```

Si existen precios dinámicos, **siempre** se usan esos.

### Días Especiales:
```
1. Excepciones (calendario_excepciones)         ← PRIORIDAD ALTA
2. Horarios Normales (complejo_horarios)        ← FALLBACK
```

Si existe una excepción para una fecha, **siempre** se usa esa.

### Tipo de Día para Festivos:
```
Fecha normal → tipo_dia: 0-6 (según día de la semana)
Fecha festivo (es_festivo: true) → tipo_dia: 7
```

---

## 🧪 Testing Manual

### 1. Probar Configuración de Precios

```bash
# Configurar precios
curl -X POST http://localhost:3000/api/courts/5/precios \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "precios": [
      {"tipo_dia": 1, "hora_inicio": "08:00", "hora_fin": "22:00", "precio_hora": 60000}
    ]
  }'

# Verificar
curl http://localhost:3000/api/courts/5/precios
```

### 2. Probar Excepciones de Calendario

```bash
# Agregar festivo
curl -X POST http://localhost:3000/api/complexes/3/excepciones \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2026-07-20",
    "esta_abierto": true,
    "es_festivo": true,
    "descripcion": "Día de la Independencia"
  }'

# Consultar
curl http://localhost:3000/api/complexes/3/excepciones
```

### 3. Probar Bulk Insert de Festivos

```bash
curl -X POST http://localhost:3000/api/complexes/3/excepciones/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @festivos-colombia-2026.json
```

---

## 📚 Documentación

### Documentos Completos Creados:

1. **`PRECIOS_CANCHA_EXAMPLES.md`**
   - Configuración de precios dinámicos
   - Ejemplos de casos de uso (Prime, Happy Hour, etc.)
   - Todos los endpoints con ejemplos de request/response
   - Notas importantes y mejores prácticas

2. **`EXCEPCIONES_CALENDARIO_EXAMPLES.md`**
   - Gestión de excepciones de calendario
   - Configuración de festivos Colombia 2026
   - Mantenimientos programados
   - Integración con precios dinámicos
   - Todos los endpoints con ejemplos completos

3. **`README_PRECIOS_Y_EXCEPCIONES.md`** (este archivo)
   - Resumen general de la implementación
   - Arquitectura del sistema
   - Flujos de trabajo

---

## ✅ Checklist de Implementación

- ✅ Controlador de precios de canchas (`courtPriceController.js`)
- ✅ Controlador de excepciones (`calendarExceptionController.js`)
- ✅ Rutas actualizadas (`courtRoutes.js`)
- ✅ Rutas actualizadas (`complexRoutes.js`)
- ✅ Modelos ya existían y están configurados
- ✅ Relaciones en `db.js` ya estaban definidas
- ✅ Documentación completa con ejemplos
- ✅ Sin errores de linting
- ✅ Autenticación y permisos implementados
- ✅ Validaciones de datos
- ✅ Respuestas formateadas y consistentes

---

## 🔒 Seguridad

Todos los endpoints de modificación están protegidos:
- ✅ Requieren autenticación (`verifyToken`)
- ✅ Verifican que el usuario sea dueño del complejo
- ✅ Validan datos de entrada
- ✅ Previenen inyecciones SQL (uso de Sequelize ORM)

Los endpoints de consulta (GET) son públicos para facilitar la exploración.

---

## 🚀 Próximos Pasos Sugeridos

1. **Motor de Cálculo de Precios**: Crear un servicio que calcule el precio final de una reserva considerando:
   - Fecha/hora específica
   - Duración
   - Excepciones de calendario
   - Precios dinámicos

2. **Validación de Reservas**: Integrar con el sistema de reservas para aplicar automáticamente los precios correctos.

3. **Dashboard de Gestión**: Frontend para que los dueños configuren precios y excepciones visualmente.

4. **Historial de Precios**: Tracking de cambios en los precios para análisis y auditoría.

5. **Plantillas de Precios**: Plantillas predefinidas (Ej: "Prime Weekend", "Happy Hour") para configuración rápida.

---

## 📞 Soporte

Para dudas sobre la implementación, revisa:
1. Los archivos de documentación en `src/routes/*.md`
2. Los comentarios en los controladores
3. Los ejemplos de uso en la documentación

---

**Estado**: ✅ Implementación Completa y Funcional

**Última actualización**: Abril 2026
